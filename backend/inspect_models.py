import os
import json
import joblib
import torch

base_dir = r"c:\Users\basan\Desktop\Confira-Ai(1)\Confira-Ai\backend\ml_models"

# 1. Voice model feature inspection
print("=== 1. VOICE MODEL DETAILS ===")
voice_path = os.path.join(base_dir, "voice_detector.pkl")
clf = joblib.load(voice_path)
print("Estimator:", type(clf))
print("n_estimators:", getattr(clf, "n_estimators", None))
print("n_features_in_:", getattr(clf, "n_features_in_", None))
print("classes_:", getattr(clf, "classes_", None))
print("feature_importances_ shape:", getattr(clf, "feature_importances_", []).shape if hasattr(clf, "feature_importances_") else None)

# 2. YOLO model details
print("\n=== 2. YOLO MODEL DETAILS ===")
yolo_path = os.path.join(base_dir, "yolo11n.pt")
try:
    ckpt = torch.load(yolo_path, map_location="cpu", weights_only=False)
    print("YOLO checkpoint keys:", list(ckpt.keys()))
    if "model" in ckpt:
        m = ckpt["model"]
        print("Model class:", type(m))
        print("Model names:", getattr(m, "names", None))
        print("Model nc (num classes):", getattr(m, "nc", None))
        print("Model args/yaml:", getattr(m, "args", None))
    if "names" in ckpt:
        print("Names in ckpt:", ckpt["names"])
except Exception as e:
    print("YOLO error:", repr(e))

# 3. Eye model details (load config.json in full)
print("\n=== 3. EYE MODEL CONFIG DETAILS ===")
conf_path = os.path.join(base_dir, "eye_detection_raw", "config.json")
if os.path.exists(conf_path):
    with open(conf_path, "r") as f:
        conf = json.load(f)
    print("JSON dumped string length:", len(json.dumps(conf)))
    layers = conf.get("config", {}).get("layers", [])
    for layer in layers:
        cfg = layer.get("config", {})
        print(f"Layer: {layer.get('class_name')} ({cfg.get('name')})")
        for k in ["scale", "offset", "divisor", "target_shape", "data_format"]:
            if k in cfg:
                print(f"   {k}: {cfg[k]}")
