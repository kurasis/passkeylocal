//! Optional, credential-free discovery of public website icons. DNS is pinned
//! to validated public addresses, including a single checked www/bare alias hop.
//! Automatic redirects and proxies cannot choose a different target.
use std::net::{IpAddr, Ipv4Addr};
#[cfg(any(windows, test))]
mod discovery;

pub fn public_domain(domain: &str) -> bool {
    let parts: Vec<_> = domain.split('.').collect();
    domain.len() <= 253
        && parts.len() >= 2
        && parts.iter().all(|part| {
            !part.is_empty()
                && part.len() <= 63
                && part.as_bytes()[0].is_ascii_alphanumeric()
                && part.as_bytes()[part.len() - 1].is_ascii_alphanumeric()
                && part
                    .bytes()
                    .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        })
        && parts.last().is_some_and(|tld| {
            ((2..=63).contains(&tld.len()) && tld.bytes().all(|b| b.is_ascii_lowercase())
                || tld.starts_with("xn--") && tld.len() >= 6)
                && ![
                    "localhost",
                    "local",
                    "internal",
                    "lan",
                    "home",
                    "arpa",
                    "test",
                    "invalid",
                    "example",
                    "onion",
                ]
                .contains(tld)
        })
}

fn public_v4(ip: Ipv4Addr) -> bool {
    let [a, b, c, _] = ip.octets();
    !(matches!(a, 0 | 10 | 127 | 224..=255)
        || a == 100 && (64..=127).contains(&b)
        || a == 169 && b == 254
        || a == 172 && (16..=31).contains(&b)
        || a == 192 && (b == 168 || b == 0 && c <= 2 || b == 88 && c == 99)
        || a == 198 && ((18..=19).contains(&b) || b == 51 && c == 100)
        || a == 203 && b == 0 && c == 113)
}

pub fn public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => public_v4(ip),
        IpAddr::V6(ip) => {
            let segments = ip.segments();
            // Global unicast only; reject transition/special/documentation prefixes.
            (0x2000..=0x3fff).contains(&segments[0])
                && !(segments[0] == 0x2001 && (segments[1] < 0x0200 || segments[1] == 0x0db8))
                && segments[0] != 0x2002
        }
    }
}

/// Accept only one exact HTTPS www/bare alias hop, preserving the fixed path.
#[cfg(any(windows, test))]
fn canonical_redirect(domain: &str, path: &str, location: &str) -> Option<String> {
    let alias = domain
        .strip_prefix("www.")
        .map(str::to_owned)
        .unwrap_or_else(|| format!("www.{domain}"));
    (public_domain(&alias) && location == format!("https://{alias}{path}")).then_some(alias)
}

#[cfg(windows)]
fn pinned_client(domain: &str) -> Option<reqwest::blocking::Client> {
    use std::{net::ToSocketAddrs, time::Duration};
    let addresses: Vec<_> = (domain, 443).to_socket_addrs().ok()?.take(16).collect();
    if addresses.is_empty() || addresses.iter().any(|a| !public_ip(a.ip())) {
        return None;
    }
    reqwest::blocking::Client::builder()
        .https_only(true)
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(8))
        .connect_timeout(Duration::from_secs(4))
        .resolve_to_addrs(domain, &addresses)
        .build()
        .ok()
}

#[cfg(windows)]
pub fn download(domain: &str) -> Option<Vec<u8>> {
    use discovery::{
        dimensions, manifest_icons, page_icons, ranked_icons, DOCUMENT_LIMIT, IMAGE_LIMIT,
        MANIFEST_LIMIT,
    };
    use std::{
        collections::HashMap,
        io::Read,
        time::{Duration, Instant},
    };
    use url::Url;
    if !public_domain(domain) {
        return None;
    }
    struct Fetcher {
        clients: HashMap<String, reqwest::blocking::Client>,
        deadline: Instant,
        remaining: usize,
    }
    impl Fetcher {
        fn get(&mut self, target: &str, limit: usize, prefix: bool) -> Option<(String, Vec<u8>)> {
            let mut url = Url::parse(target).ok()?;
            for hop in 0..2 {
                if self.remaining == 0 {
                    return None;
                }
                self.remaining -= 1;
                let remaining = self
                    .deadline
                    .saturating_duration_since(Instant::now())
                    .min(Duration::from_secs(3));
                if remaining.is_zero() {
                    return None;
                }
                let host = url.host_str()?.to_owned();
                if let std::collections::hash_map::Entry::Vacant(entry) =
                    self.clients.entry(host.clone())
                {
                    entry.insert(pinned_client(&host)?);
                }
                let response = self.clients.get(&host)?.get(url.as_str())
                    .header("Accept", if prefix { "text/html" } else { "image/png,image/x-icon,image/vnd.microsoft.icon,application/manifest+json" })
                    .header("Cache-Control", "no-store").timeout(remaining).send().ok()?;
                if response.status().is_redirection() && hop == 0 {
                    let path = format!(
                        "{}{}",
                        url.path(),
                        url.query().map(|q| format!("?{q}")).unwrap_or_default()
                    );
                    if let Some(alias) = response
                        .headers()
                        .get("location")
                        .and_then(|v| v.to_str().ok())
                        .and_then(|v| canonical_redirect(&host, &path, v))
                    {
                        url.set_host(Some(&alias)).ok()?;
                        continue;
                    }
                }
                if !response.status().is_success()
                    || !prefix && response.content_length().is_some_and(|n| n > limit as u64)
                {
                    return None;
                }
                let mut bytes = Vec::new();
                response
                    .take(limit as u64 + 1)
                    .read_to_end(&mut bytes)
                    .ok()?;
                if bytes.len() > limit {
                    if !prefix {
                        return None;
                    }
                    bytes.truncate(limit);
                }
                return Some((url.into(), bytes));
            }
            None
        }
    }
    let mut fetcher = Fetcher {
        clients: HashMap::new(),
        deadline: Instant::now() + Duration::from_secs(12),
        remaining: 12,
    };
    let origin = format!("https://{domain}/");
    let page = fetcher.get(&origin, DOCUMENT_LIMIT, true);
    let base = page.as_ref().map(|p| p.0.as_str()).unwrap_or(&origin);
    let (mut icons, manifest) = page
        .as_ref()
        .map(|p| page_icons(&String::from_utf8_lossy(&p.1), base))
        .unwrap_or_default();
    if let Some(url) = manifest {
        if fetcher.remaining > 4 {
            if let Some((url, text)) = fetcher.get(&url, MANIFEST_LIMIT, false) {
                icons.extend(manifest_icons(&String::from_utf8_lossy(&text), &url));
            }
        }
    }
    let mut best = None;
    let mut quality = 0;
    for url in ranked_icons(icons, base) {
        if fetcher.remaining <= 2 && Url::parse(&url).ok()?.path() != "/favicon.ico" {
            continue;
        }
        let Some((_, bytes)) = fetcher.get(&url, IMAGE_LIMIT, false) else {
            continue;
        };
        let Some((w, h, png)) = dimensions(&bytes) else {
            continue;
        };
        if w.max(h) > w.min(h) * 2 {
            continue;
        }
        let score = w.min(h) * 2 + usize::from(png);
        if score > quality {
            quality = score;
            best = Some(bytes);
        }
        if png && w.min(h) >= 128 {
            break;
        }
    }
    best
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn canonical_redirect_preserves_exact_host_relation_and_fixed_path() {
        let domain = "synthetic-icon-fixture.com";
        assert_eq!(
            canonical_redirect(
                domain,
                "/favicon.ico",
                "https://www.synthetic-icon-fixture.com/favicon.ico"
            ),
            Some(format!("www.{domain}"))
        );
        assert_eq!(
            canonical_redirect(
                &format!("www.{domain}"),
                "/favicon.ico",
                "https://synthetic-icon-fixture.com/favicon.ico"
            ),
            Some(domain.to_owned())
        );
        for location in [
            "https://other-site.com/favicon.ico",
            "http://127.0.0.1/favicon.ico",
            "http://www.synthetic-icon-fixture.com/favicon.ico",
            "https://www.synthetic-icon-fixture.com:8443/favicon.ico",
            "https://user:pw@www.synthetic-icon-fixture.com/favicon.ico",
            "https://www.synthetic-icon-fixture.com/private",
            "https://www.synthetic-icon-fixture.com/favicon.ico?q=1",
            "https://www.synthetic-icon-fixture.com/favicon.ico#fragment",
        ] {
            assert_eq!(
                canonical_redirect(domain, "/favicon.ico", location),
                None,
                "{location}"
            );
        }
    }

    #[test]
    fn rejects_non_domains_and_non_public_routes() {
        for domain in [
            "localhost",
            "127.0.0.1",
            "evil.com/path",
            "foo.local",
            "foo.test",
            "foo.com:80",
            "user@foo.com",
            "Foo.com",
            "foo.com.",
            "-foo.com",
        ] {
            assert!(!public_domain(domain), "{domain}");
        }
        for domain in ["github.com", "sub.github.com", "xn--e1afmkfd.xn--p1ai"] {
            assert!(public_domain(domain));
        }
        for ip in [
            "127.0.0.1",
            "10.0.0.1",
            "100.64.0.1",
            "169.254.169.254",
            "172.16.0.1",
            "192.168.1.1",
            "192.0.2.1",
            "198.18.0.1",
            "224.0.0.1",
            "::1",
            "::ffff:127.0.0.1",
            "fc00::1",
            "2001:db8::1",
            "2002:7f00:1::1",
        ] {
            assert!(!public_ip(ip.parse().unwrap()), "{ip}");
        }
        for ip in ["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"] {
            assert!(public_ip(ip.parse().unwrap()));
        }
    }
}
