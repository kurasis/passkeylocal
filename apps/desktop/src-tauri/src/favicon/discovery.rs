//! Inert, bounded public metadata discovery; never evaluates website scripts.
use super::public_domain;
use scraper::{ElementRef, Html, Selector};
use url::Url;

pub(super) const DOCUMENT_LIMIT: usize = 131_072;
pub(super) const MANIFEST_LIMIT: usize = 32_768;
pub(super) const IMAGE_LIMIT: usize = 262_144;

#[derive(Clone)]
pub(super) struct Candidate {
    pub url: String,
    pub size: usize,
    pub png: bool,
}

pub(super) fn public_url(reference: &str, base: &str) -> Option<String> {
    if reference.is_empty()
        || reference.len() > 2048
        || reference.chars().any(|c| c == '\\' || c.is_ascii_control())
    {
        return None;
    }
    let mut url = Url::parse(base).ok()?.join(reference.trim()).ok()?;
    if url.scheme() != "https"
        || url.port().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
        || !public_domain(url.host_str()?)
    {
        return None;
    }
    url.set_fragment(None);
    if url.as_str().len() > 2048 {
        return None;
    }
    Some(url.into())
}

fn candidate(href: &str, base: &str, sizes: &str, mime: &str, apple: bool) -> Option<Candidate> {
    let url = public_url(href, base)?;
    let mime = mime.to_ascii_lowercase();
    let path = Url::parse(&url).ok()?.path().to_ascii_lowercase();
    if ["svg", "jpeg", "webp", "gif"]
        .iter()
        .any(|s| mime.contains(s))
        || [".svg", ".jpg", ".jpeg", ".webp", ".gif"]
            .iter()
            .any(|s| path.ends_with(s))
    {
        return None;
    }
    let size = sizes
        .split_ascii_whitespace()
        .take(16)
        .filter_map(|value| {
            let value = value.to_ascii_lowercase();
            let (w, h) = value.split_once('x')?;
            if w.len() > 4 || h.len() > 4 {
                return None;
            }
            let (w, h) = (w.parse::<usize>().ok()?, h.parse::<usize>().ok()?);
            (w.max(h) <= 1024).then_some(w.min(h))
        })
        .max()
        .unwrap_or(0)
        .max(if apple { 180 } else { 0 });
    Some(Candidate {
        url,
        size,
        png: apple || mime == "image/png" || path.ends_with(".png"),
    })
}

pub(super) fn page_icons(text: &str, base: &str) -> (Vec<Candidate>, Option<String>) {
    let html = Html::parse_document(text);
    let selector = Selector::parse("link, meta, img").expect("constant metadata selector");
    let mut icons = Vec::new();
    let mut manifest = None;
    for link in html.select(&selector) {
        if link.ancestors().any(|node| {
            ElementRef::wrap(node).is_some_and(|e| {
                ["template", "noscript", "svg", "math"].contains(&e.value().name())
            })
        }) {
            continue;
        }
        let attrs = link.value();
        if icons.len() < 32
            && attrs.name() == "meta"
            && attrs
                .attr("itemprop")
                .unwrap_or("")
                .split_ascii_whitespace()
                .any(|p| ["image", "logo"].contains(&p.to_ascii_lowercase().as_str()))
        {
            if let Some(icon) = candidate(
                attrs.attr("content").unwrap_or(""),
                base,
                "128x128",
                "",
                false,
            )
            .filter(|c| c.png)
            {
                icons.push(icon);
            }
        }
        if icons.len() < 32 && attrs.name() == "img" {
            let labels = format!(
                "{} {}",
                attrs.attr("id").unwrap_or(""),
                attrs.attr("class").unwrap_or("")
            )
            .to_ascii_lowercase();
            if labels
                .split(|c: char| c == '-' || c == '_' || c.is_ascii_whitespace())
                .any(|v| v == "logo" || v == "brand")
            {
                if let Some(icon) =
                    candidate(attrs.attr("src").unwrap_or(""), base, "96x96", "", false)
                        .filter(|c| c.png)
                {
                    icons.push(icon);
                }
            }
        }
        if attrs.name() != "link" {
            continue;
        }
        let rel = attrs.attr("rel").unwrap_or("").to_ascii_lowercase();
        let rel: Vec<_> = rel.split_ascii_whitespace().collect();
        let href = attrs.attr("href").unwrap_or("");
        if manifest.is_none() && rel.contains(&"manifest") {
            manifest = public_url(href, base);
        }
        if icons.len() < 32
            && rel
                .iter()
                .any(|r| ["icon", "apple-touch-icon", "apple-touch-icon-precomposed"].contains(r))
        {
            if let Some(icon) = candidate(
                href,
                base,
                attrs.attr("sizes").unwrap_or(""),
                attrs.attr("type").unwrap_or(""),
                rel.iter().any(|r| r.starts_with("apple-touch-icon")),
            ) {
                icons.push(icon);
            }
        }
    }
    (icons, manifest)
}

pub(super) fn manifest_icons(text: &str, base: &str) -> Vec<Candidate> {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(text) else {
        return Vec::new();
    };
    let Some(icons) = value.get("icons").and_then(|v| v.as_array()) else {
        return Vec::new();
    };
    icons
        .iter()
        .take(32)
        .filter_map(|v| {
            candidate(
                v.get("src")?.as_str()?,
                base,
                v.get("sizes").and_then(|v| v.as_str()).unwrap_or(""),
                v.get("type").and_then(|v| v.as_str()).unwrap_or(""),
                false,
            )
        })
        .collect()
}

pub(super) fn ranked_icons(icons: Vec<Candidate>, base: &str) -> Vec<String> {
    let mut unique: Vec<Candidate> = Vec::new();
    for icon in icons {
        if let Some(old) = unique.iter_mut().find(|old| old.url == icon.url) {
            if icon.size + usize::from(icon.png) > old.size + usize::from(old.png) {
                *old = icon;
            }
        } else {
            unique.push(icon);
        }
    }
    unique
        .sort_by_key(|icon| std::cmp::Reverse(icon.size.min(512) + if icon.png { 16 } else { 0 }));
    let mut urls: Vec<_> = unique.into_iter().take(4).map(|icon| icon.url).collect();
    for path in ["/apple-touch-icon.png", "/favicon.png", "/favicon.ico"] {
        if let Some(url) = public_url(path, base) {
            if !urls.contains(&url) {
                urls.push(url);
            }
        }
    }
    urls
}

pub(super) fn dimensions(bytes: &[u8]) -> Option<(usize, usize, bool)> {
    if bytes.len() < 24 || bytes.len() > IMAGE_LIMIT {
        return None;
    }
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") && &bytes[12..16] == b"IHDR" {
        let w = u32::from_be_bytes(bytes[16..20].try_into().ok()?) as usize;
        let h = u32::from_be_bytes(bytes[20..24].try_into().ok()?) as usize;
        return (w > 0 && h > 0 && w <= 512 && h <= 512).then_some((w, h, true));
    }
    if !bytes.starts_with(&[0, 0, 1, 0]) {
        return None;
    }
    let count = u16::from_le_bytes(bytes[4..6].try_into().ok()?) as usize;
    if count == 0 || count > 32 || 6 + count * 16 > bytes.len() {
        return None;
    }
    let mut best = (0, 0, false);
    for n in 0..count {
        let p = 6 + n * 16;
        let size = u32::from_le_bytes(bytes[p + 8..p + 12].try_into().ok()?) as usize;
        let offset = u32::from_le_bytes(bytes[p + 12..p + 16].try_into().ok()?) as usize;
        if size == 0 || offset < 6 + count * 16 || offset.checked_add(size)? > bytes.len() {
            return None;
        }
        let w = if bytes[p] == 0 {
            256
        } else {
            bytes[p] as usize
        };
        let h = if bytes[p + 1] == 0 {
            256
        } else {
            bytes[p + 1] as usize
        };
        if w.min(h) > best.0.min(best.1) {
            best = (w, h, false);
        }
    }
    Some(best)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shared_public_metadata_fixture_ignores_inert_links_and_ranks_pngs() {
        let f: serde_json::Value = serde_json::from_str(include_str!(
            "../../../../../tests/fixtures/icons/discovery.json"
        ))
        .unwrap();
        let html = f["html"].as_str().unwrap();
        let text = f["manifest"].as_str().unwrap();
        assert!(html.len() < DOCUMENT_LIMIT && text.len() < MANIFEST_LIMIT);
        let (mut icons, manifest) = page_icons(html, f["base"].as_str().unwrap());
        assert_eq!(
            manifest.as_deref(),
            Some("https://www.synthetic-icon-fixture.com/assets/app.webmanifest")
        );
        icons.extend(manifest_icons(text, manifest.as_deref().unwrap()));
        assert_eq!(
            ranked_icons(icons, f["base"].as_str().unwrap()),
            f["expected"]
                .as_array()
                .unwrap()
                .iter()
                .map(|v| v.as_str().unwrap().to_owned())
                .collect::<Vec<_>>()
        );
        let png = include_bytes!("../../../../../tests/fixtures/icons/retina-192.png");
        assert_eq!(dimensions(png), Some((192, 192, true)));
        for target in [
            "http://127.0.0.1/a.png",
            "https://127.0.0.1/a.png",
            "https://user:pw@site.com/a.png",
            "https://site.com:8443/a.png",
            "file:///secret",
            "data:image/png,foo",
            "https://foo.local/a.png",
            "https://site.com\\@evil.com/a.png",
        ] {
            assert!(
                public_url(target, "https://synthetic-icon-fixture.com/").is_none(),
                "{target}"
            );
        }
    }
}
