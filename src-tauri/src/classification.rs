//! Pure, data-driven scoring. The engine consumes normalized signals only;
//! fingerprint extraction and history analysis happen before this module.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

const EMBEDDED_RULES: &str = include_str!("../resources/classification_rules.json");

#[derive(Debug, Clone, Default)]
pub struct DeviceFeatures {
    pub signals: HashSet<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct RuleFile {
    rules: Vec<RuleSpec>,
}

#[derive(Debug, Clone, Deserialize)]
struct RuleSpec {
    id: String,
    dimension: String,
    target: String,
    #[serde(default)]
    all: Vec<String>,
    #[serde(default)]
    any: Vec<String>,
    weight: i32,
    #[serde(default = "default_reliability")]
    reliability: f32,
    label: String,
    source: String,
}

fn default_reliability() -> f32 {
    1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Match {
    pub rule_id: String,
    pub label: String,
    pub source: String,
    pub raw_weight: i32,
    pub reliability: f32,
    pub effective_weight: i32,
    pub negative: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassificationScore {
    pub target: String,
    pub score: i32,
    pub confidence: i32,
    pub matched_features: Vec<Match>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceClassification {
    pub device_type: String,
    pub role: Option<String>,
    pub roles: Vec<ClassificationScore>,
    pub os: Option<String>,
    pub os_confidence: i32,
    pub confidence: i32,
    pub matched_features: Vec<Match>,
    pub negative_features: Vec<Match>,
    pub alternative_types: Vec<String>,
    pub hierarchy: Vec<String>,
}

pub struct ClassificationEngine;

impl ClassificationEngine {
    pub fn classify(features: &DeviceFeatures) -> DeviceClassification {
        let file: RuleFile =
            serde_json::from_str(EMBEDDED_RULES).expect("classification rules are valid");
        Self::classify_with_rules(features, &file.rules)
    }

    fn classify_with_rules(features: &DeviceFeatures, rules: &[RuleSpec]) -> DeviceClassification {
        let mut scores: HashMap<(String, String), i32> = HashMap::new();
        let mut matches: HashMap<(String, String), Vec<Match>> = HashMap::new();
        let mut source_scores: HashMap<(String, String, String), i32> = HashMap::new();

        for rule in rules.iter().filter(|rule| conditions_match(rule, features)) {
            let key = (rule.dimension.clone(), rule.target.clone());
            let source_key = (key.0.clone(), key.1.clone(), rule.source.clone());
            let current = source_scores.entry(source_key).or_default();
            let raw_effective = (rule.weight as f32 * rule.reliability).round() as i32;
            let effective = if raw_effective >= 0 {
                raw_effective.min((100 - *current).max(0))
            } else {
                raw_effective.max(-100)
            };
            if effective == 0 {
                continue;
            }
            *current += effective;
            *scores.entry(key.clone()).or_default() += effective;
            matches.entry(key).or_default().push(Match {
                rule_id: rule.id.clone(),
                label: rule.label.clone(),
                source: rule.source.clone(),
                raw_weight: rule.weight,
                reliability: rule.reliability,
                effective_weight: effective,
                negative: effective < 0,
            });
        }

        let type_scores = dimension_scores(&scores, "type");
        let role_scores = dimension_scores(&scores, "role");
        let os_scores = dimension_scores(&scores, "os");
        let (device_type, type_score, alternatives) = choose(&type_scores, "unknown");
        let (role, _, _) = choose(&role_scores, "");
        let (os, os_score, _) = choose(&os_scores, "");
        let roles = role_scores
            .iter()
            .take(4)
            .filter_map(|(target, score)| {
                if *score < 25 {
                    return None;
                }
                Some(ClassificationScore {
                    target: target.clone(),
                    score: *score,
                    confidence: score_confidence(
                        *score,
                        role_scores.get(1).map(|(_, s)| *s).unwrap_or(0),
                    ),
                    matched_features: matches
                        .get(&(String::from("role"), target.clone()))
                        .cloned()
                        .unwrap_or_default(),
                })
            })
            .collect::<Vec<_>>();
        let type_matches = matches
            .get(&(String::from("type"), device_type.clone()))
            .cloned()
            .unwrap_or_default();
        let role_matches = matches
            .get(&(String::from("role"), role.clone()))
            .cloned()
            .unwrap_or_default();
        let os_matches = matches
            .get(&(String::from("os"), os.clone()))
            .cloned()
            .unwrap_or_default();
        let matched_features = type_matches
            .into_iter()
            .chain(role_matches)
            .chain(os_matches)
            .filter(|item| !item.negative)
            .collect::<Vec<_>>();
        let negative_features = matches
            .values()
            .flatten()
            .filter(|item| item.negative)
            .cloned()
            .collect::<Vec<_>>();
        let type_known =
            device_type != "unknown" && type_score >= 35 && margin_ok(&type_scores, type_score);
        let confidence = score_confidence(
            type_score.max(role_scores.first().map(|(_, s)| *s).unwrap_or(0)),
            0,
        );
        let role_value = if role.is_empty()
            || role_scores.first().map(|(_, score)| *score).unwrap_or(0) < 35
            || !margin_ok(
                &role_scores,
                role_scores.first().map(|(_, score)| *score).unwrap_or(0),
            ) {
            None
        } else {
            Some(role)
        };
        let os_value = if os.is_empty() || os_score < 25 {
            None
        } else {
            Some(os)
        };
        let mut hierarchy = Vec::new();
        if type_known {
            hierarchy.push(device_type.clone());
        }
        if let Some(value) = role_value.clone() {
            hierarchy.push(value);
        }
        if let Some(value) = os_value.clone() {
            hierarchy.push(value);
        }
        DeviceClassification {
            device_type: if type_known {
                device_type
            } else {
                "unknown".into()
            },
            role: role_value,
            roles,
            os: os_value,
            os_confidence: score_confidence(
                os_score,
                os_scores.get(1).map(|(_, s)| *s).unwrap_or(0),
            ),
            confidence: if type_known {
                confidence
            } else {
                confidence.min(44)
            },
            matched_features,
            negative_features,
            alternative_types: alternatives,
            hierarchy,
        }
    }
}

fn conditions_match(rule: &RuleSpec, features: &DeviceFeatures) -> bool {
    rule.all
        .iter()
        .all(|signal| features.signals.contains(signal))
        && (rule.any.is_empty()
            || rule
                .any
                .iter()
                .any(|signal| features.signals.contains(signal)))
}

fn dimension_scores(
    scores: &HashMap<(String, String), i32>,
    dimension: &str,
) -> Vec<(String, i32)> {
    let mut values: Vec<_> = scores
        .iter()
        .filter(|((d, _), _)| d == dimension)
        .map(|((_, target), score)| (target.clone(), *score))
        .collect();
    values.sort_by(|a, b| b.1.cmp(&a.1));
    values
}

fn choose(values: &[(String, i32)], fallback: &str) -> (String, i32, Vec<String>) {
    let best = values
        .first()
        .cloned()
        .unwrap_or_else(|| (fallback.into(), 0));
    let alternatives = values
        .iter()
        .skip(1)
        .filter(|(_, score)| *score >= 20)
        .take(5)
        .map(|(target, score)| format!("{target}:{score}"))
        .collect();
    (best.0, best.1, alternatives)
}

fn margin_ok(values: &[(String, i32)], best: i32) -> bool {
    best >= values.get(1).map(|(_, score)| *score).unwrap_or(0) + 12
}

fn score_confidence(score: i32, second: i32) -> i32 {
    if score <= 0 {
        return 0;
    }
    (30.0 + score as f64 * 0.37 + (score - second).max(0) as f64 * 0.08)
        .round()
        .min(99.0) as i32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn smb_alone_does_not_make_a_nas() {
        let mut features = DeviceFeatures::default();
        features.signals.insert("smb".into());
        let result = ClassificationEngine::classify(&features);
        assert_eq!(result.role, None);
    }

    #[test]
    fn gateway_is_a_network_device_with_router_role() {
        let mut features = DeviceFeatures::default();
        features
            .signals
            .extend(["gateway", "routing-table", "dns-server"].map(String::from));
        let result = ClassificationEngine::classify(&features);
        assert_eq!(result.device_type, "router");
        assert_eq!(result.role.as_deref(), Some("router"));
    }

    #[test]
    fn os_is_scored_by_rules() {
        let mut features = DeviceFeatures::default();
        features
            .signals
            .extend(["smb:windows", "netbios", "rdp"].map(String::from));
        let result = ClassificationEngine::classify(&features);
        assert_eq!(result.os.as_deref(), Some("windows"));
    }

    #[test]
    fn negative_matches_are_retained_for_explanations() {
        let mut features = DeviceFeatures::default();
        features
            .signals
            .extend(["rtsp", "onvif", "smb"].map(String::from));
        let result = ClassificationEngine::classify(&features);
        assert!(result
            .negative_features
            .iter()
            .any(|item| item.label.contains("ONVIF")));
    }
}
