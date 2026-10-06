//! Monotonic session deadline independent of any filesystem mutex or WebView timer.
use std::time::{Duration, Instant};

pub struct Inactivity {
    interval: Duration,
    deadline: Option<Instant>,
}
impl Inactivity {
    pub fn new(interval: Duration) -> Self {
        Self {
            interval,
            deadline: None,
        }
    }
    pub fn begin(&mut self, now: Instant, interval: Duration) {
        self.interval = interval;
        self.deadline = Some(now + interval);
    }
    pub fn activity(&mut self, now: Instant) {
        // Activity can extend a live session, never revive an expired one.
        if self.deadline.is_some() && !self.expired(now) {
            self.deadline = Some(now + self.interval);
        }
    }
    pub fn interval(&mut self, interval: Duration) {
        self.interval = interval;
    }
    pub fn deadline(&self) -> Option<Instant> {
        self.deadline
    }
    pub fn expired(&self, now: Instant) -> bool {
        self.deadline.is_none_or(|deadline| now >= deadline)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn exact_deadline_locks_and_activity_cannot_revive_without_a_new_session() {
        let now = Instant::now();
        let interval = Duration::from_secs(30);
        let mut clock = Inactivity::new(interval);
        clock.activity(now);
        assert!(clock.expired(now));
        clock.begin(now, interval);
        clock.activity(now + Duration::from_secs(20));
        assert!(!clock.expired(now + Duration::from_secs(49)));
        assert!(clock.expired(now + Duration::from_secs(50)));
        clock.activity(now + Duration::from_secs(51));
        assert!(clock.expired(now + Duration::from_secs(51)));
        clock.begin(now + Duration::from_secs(52), interval);
        clock.interval(Duration::from_secs(60));
        clock.activity(now + Duration::from_secs(53));
        assert!(!clock.expired(now + Duration::from_secs(112)));
        assert!(clock.expired(now + Duration::from_secs(113)));
    }
}
