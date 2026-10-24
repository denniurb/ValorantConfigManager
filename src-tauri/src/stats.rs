//! HenrikDev-API-Proxy mit kleinem TTL-Cache (umgeht CORS, schont das Rate-Limit).

use std::{
    collections::HashMap,
    sync::Mutex,
    time::{Duration, Instant},
};

const API_BASE: &str = "https://api.henrikdev.xyz/valorant/";

#[derive(Default)]
pub struct StatsState {
    client: reqwest::Client,
    cache: Mutex<HashMap<String, (String, Instant)>>,
}

impl StatsState {
    pub async fn get(&self, path: &str, ttl_secs: u64, api_key: &str) -> Result<String, String> {
        if path.contains("://") || path.starts_with('/') {
            return Err("Ungültiger API-Pfad".into());
        }
        let url = format!("{API_BASE}{path}");
        if let Some((body, at)) = self.cache.lock().unwrap().get(&url) {
            if at.elapsed() < Duration::from_secs(ttl_secs) {
                return Ok(body.clone());
            }
        }
        let resp = self
            .client
            .get(&url)
            .header("Authorization", api_key)
            .timeout(Duration::from_secs(20))
            .send()
            .await
            .map_err(|e| format!("Netzwerkfehler: {e}"))?;
        let status = resp.status();
        let body = resp.text().await.map_err(|e| e.to_string())?;
        if !status.is_success() {
            return Err(match status.as_u16() {
                401 | 403 => "API Key ungültig".into(),
                404 => "Spieler nicht gefunden".into(),
                429 => "Rate-Limit erreicht — kurz warten".into(),
                code => format!("API-Fehler {code}"),
            });
        }
        self.cache.lock().unwrap().insert(url, (body.clone(), Instant::now()));
        Ok(body)
    }

    pub fn invalidate(&self, fragment: &str) {
        self.cache.lock().unwrap().retain(|k, _| !k.contains(fragment));
    }
}
