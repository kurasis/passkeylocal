//! Optional, credential-free requests to fixed HTTPS icon paths. DNS is pinned
//! to validated public addresses, including a single checked www/bare alias hop.
//! Automatic redirects and proxies cannot choose a different target.
use std::net::{IpAddr, Ipv4Addr};

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

#[cfg(windows)]
fn raster_signature(bytes: &[u8]) -> bool {
    bytes.starts_with(b"\x89PNG\r\n\x1a\n") || bytes.starts_with(&[0, 0, 1, 0])
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
    use std::{
        io::Read,
        time::{Duration, Instant},
    };
    if !public_domain(domain) {
        return None;
    }
    let deadline = Instant::now() + Duration::from_secs(8);
    let original = pinned_client(domain)?;
    for path in ["/favicon.ico", "/apple-touch-icon.png"] {
        let mut host = domain.to_owned();
        let mut client = original.clone();
        for hop in 0..2 {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return None;
            }
            let response = match client
                .get(format!("https://{host}{path}"))
                .header("Accept", "image/png,image/x-icon,image/vnd.microsoft.icon")
                .header("Cache-Control", "no-store")
                .timeout(remaining)
                .send()
            {
                Ok(r) => r,
                Err(_) => break,
            };
            if response.status().is_redirection() && hop == 0 {
                if let Some(alias) = response
                    .headers()
                    .get("location")
                    .and_then(|value| value.to_str().ok())
                    .and_then(|location| canonical_redirect(domain, path, location))
                {
                    // Resolve, validate and pin the alias separately. Never use automatic redirects.
                    if let Some(pinned) = pinned_client(&alias) {
                        client = pinned;
                        host = alias;
                        continue;
                    }
                }
            }
            if !response.status().is_success()
                || response.content_length().is_some_and(|n| n > 65_536)
            {
                break;
            }
            let mut bytes = Vec::new();
            if response.take(65_537).read_to_end(&mut bytes).is_ok()
                && !bytes.is_empty()
                && bytes.len() <= 65_536
                && raster_signature(&bytes)
            {
                return Some(bytes);
            }
            break;
        }
    }
    None
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
