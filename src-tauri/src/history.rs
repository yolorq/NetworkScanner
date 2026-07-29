use std::collections::HashSet;

#[derive(Debug, Clone, Default)]
pub struct ClassificationHistory {
    pub device_type: Option<String>,
    pub role: Option<String>,
    pub confidence: i32,
}

/// Converts historical context into ordinary normalized signals. The rule
/// engine never reads a history object and therefore remains stateless.
pub fn signals(history: Option<&ClassificationHistory>) -> HashSet<String> {
    let mut result = HashSet::new();
    if let Some(history) = history.filter(|item| item.confidence >= 70) {
        result.insert("history:compatible".into());
        if let Some(device_type) = &history.device_type {
            result.insert(format!("history:type:{device_type}"));
        }
        if let Some(role) = &history.role {
            result.insert(format!("history:role:{role}"));
        }
    }
    result
}
