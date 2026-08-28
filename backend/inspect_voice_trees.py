import os
import joblib
import numpy as np

base_dir = r"c:\Users\basan\Desktop\Confira-Ai(1)\Confira-Ai\backend\ml_models"
voice_path = os.path.join(base_dir, "voice_detector.pkl")
clf = joblib.load(voice_path)

print("=== TREE DETAILS FOR VOICE DETECTOR ===")
print("Classes:", clf.classes_)
features_used = set()
for tree in clf.estimators_:
    f = tree.tree_.feature
    for feat in f:
        if feat >= 0:
            features_used.add(int(feat))

print("Total unique features used across all 300 trees:", len(features_used))
print("Indices of features used:", sorted(list(features_used)))

# Inspect thresholds
thresholds = []
for tree in clf.estimators_[:10]:
    t = tree.tree_.threshold[tree.tree_.feature >= 0]
    thresholds.extend(t)
print("Sample split thresholds:", thresholds[:15])

# Test inference with synthetic 80-dim feature vector
test_feat = np.zeros((1, 80))
pred = clf.predict(test_feat)
prob = clf.predict_proba(test_feat)
print("Prediction on zeros:", pred, "Probabilities:", prob)

test_feat2 = np.ones((1, 80)) * 50
print("Prediction on 50s:", clf.predict(test_feat2), "Probabilities:", clf.predict_proba(test_feat2))
