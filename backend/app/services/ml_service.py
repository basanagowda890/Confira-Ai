import base64
import io
import logging
import os
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
from PIL import Image

logger = logging.getLogger("ml_service")

# Global singleton
_ml_instance = None
_ml_lock = threading.Lock()


class MLService:
    def __init__(self):
        self.base_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "ml_models")
        )
        self.voice_model = None
        self.eye_model = None
        self.yolo_model = None

        self.voice_loaded = False
        self.eye_loaded = False
        self.yolo_loaded = False

        self.eye_class_labels = {
            0: "looking_at_screen",
            1: "looking_away",
            2: "eyes_closed",
        }
        self.voice_class_labels = {
            0: "non_voice",
            1: "voice",
        }

        self.load_lock = threading.Lock()
        self._initialized = False

    def initialize(self):
        with self.load_lock:
            if self._initialized:
                return
            self._load_voice_model()
            self._load_eye_model()
            self._load_yolo_model()
            self._initialized = True

    def _load_voice_model(self):
        voice_path = os.path.join(self.base_dir, "voice_detector.pkl")
        if not os.path.exists(voice_path):
            voice_path = os.path.join(self.base_dir, "ai_interview_models", "voice_detector.pkl")

        if os.path.exists(voice_path):
            try:
                self.voice_model = joblib.load(voice_path)
                self.voice_loaded = True
                logger.info("Voice Detector model loaded successfully from %s", voice_path)
            except Exception as e:
                logger.error("Failed to load voice detector model: %s", e)
                self.voice_loaded = False
        else:
            logger.warning("Voice detector model file not found at %s", voice_path)
            self.voice_loaded = False

    def _load_eye_model(self):
        eye_path = os.path.join(self.base_dir, "eye_detection_model.keras")
        if not os.path.exists(eye_path):
            eye_path = os.path.join(self.base_dir, "ai_interview_models", "eye_detection_model.keras")

        if os.path.exists(eye_path):
            try:
                import keras
                self.eye_model = keras.models.load_model(eye_path)
                self.eye_loaded = True
                logger.info("Eye Detection model loaded successfully from %s", eye_path)
            except Exception as e:
                logger.error("Failed to load eye detection model: %s", e)
                self.eye_loaded = False
        else:
            logger.warning("Eye detection model file not found at %s", eye_path)
            self.eye_loaded = False

    def _load_yolo_model(self):
        yolo_path = os.path.join(self.base_dir, "yolo11n.pt")
        if os.path.exists(yolo_path):
            try:
                from ultralytics import YOLO
                self.yolo_model = YOLO(yolo_path)
                self.yolo_loaded = True
                logger.info("YOLO11n model loaded successfully from %s", yolo_path)
            except Exception as e:
                logger.error("Failed to load YOLO model: %s", e)
                self.yolo_loaded = False
        else:
            logger.warning("YOLO model file not found at %s", yolo_path)
            self.yolo_loaded = False

    def get_status(self) -> Dict[str, Any]:
        if not self._initialized:
            self.initialize()
        return {
            "status": "ok" if (self.voice_loaded or self.eye_loaded or self.yolo_loaded) else "unavailable",
            "models": {
                "eye": self.eye_loaded,
                "voice": self.voice_loaded,
                "yolo": self.yolo_loaded,
            },
            "classes": {
                "eye": list(self.eye_class_labels.values()),
                "voice": list(self.voice_class_labels.values()),
                "yolo_classes_count": len(self.yolo_model.names) if self.yolo_loaded and hasattr(self.yolo_model, "names") else 0,
            }
        }

    # --------------------------------------------------------------------------
    # VOICE INFERENCE (80 MFCC features: 40 mean + 40 std)
    # --------------------------------------------------------------------------
    def analyze_voice(self, audio_bytes: bytes, sample_rate: int = 16000) -> Dict[str, Any]:
        if not self._initialized:
            self.initialize()
        if not self.voice_loaded or self.voice_model is None:
            return {"available": False, "error": "Voice model not loaded"}

        try:
            import soundfile as sf
            import librosa

            # Decode audio from bytes (supports WAV, OGG, WebM/Raw PCM)
            try:
                with io.BytesIO(audio_bytes) as bio:
                    audio_data, sr = sf.read(bio)
            except Exception:
                # Fallback to librosa if soundfile direct decode needs wrapper
                with io.BytesIO(audio_bytes) as bio:
                    audio_data, sr = librosa.load(bio, sr=sample_rate)

            # Convert multi-channel to mono
            if audio_data.ndim > 1:
                audio_data = np.mean(audio_data, axis=1)

            # Resample if needed
            if sr != sample_rate:
                audio_data = librosa.resample(audio_data, orig_sr=sr, target_sr=sample_rate)

            # Check if completely silent
            rms = np.sqrt(np.mean(audio_data**2))
            if rms < 1e-4:
                return {
                    "available": True,
                    "label": "non_voice",
                    "confidence": 0.99,
                    "is_voice": False,
                    "rms_energy": float(rms),
                    "probabilities": {"non_voice": 0.99, "voice": 0.01}
                }

            # Extract 40 MFCCs
            mfccs = librosa.feature.mfcc(y=audio_data.astype(np.float32), sr=sample_rate, n_mfcc=40)
            mfcc_mean = np.mean(mfccs, axis=1)
            mfcc_std = np.std(mfccs, axis=1)
            features = np.concatenate([mfcc_mean, mfcc_std]).reshape(1, 80)

            # Predict
            pred = int(self.voice_model.predict(features)[0])
            prob = self.voice_model.predict_proba(features)[0]
            confidence = float(prob[pred])
            label = self.voice_class_labels.get(pred, "unknown")

            return {
                "available": True,
                "label": label,
                "confidence": round(confidence, 3),
                "is_voice": bool(pred == 1),
                "rms_energy": float(round(rms, 4)),
                "probabilities": {
                    "non_voice": round(float(prob[0]), 3),
                    "voice": round(float(prob[1]), 3),
                }
            }
        except Exception as exc:
            logger.warning("Voice analysis error: %s", exc)
            return {"available": False, "error": str(exc)}

    # --------------------------------------------------------------------------
    # EYE INFERENCE (MobileNetV2: input shape 96x48x3)
    # --------------------------------------------------------------------------
    def analyze_eye(self, image: Image.Image | np.ndarray) -> Dict[str, Any]:
        if not self._initialized:
            self.initialize()
        if not self.eye_loaded or self.eye_model is None:
            return {"available": False, "error": "Eye model not loaded"}

        try:
            if isinstance(image, np.ndarray):
                pil_img = Image.fromarray(image)
            else:
                pil_img = image

            # Convert to RGB
            pil_img = pil_img.convert("RGB")
            # Resize to expected model input: (Width=48, Height=96)
            pil_img_resized = pil_img.resize((48, 96))
            img_arr = np.array(pil_img_resized, dtype=np.float32)
            input_tensor = np.expand_dims(img_arr, axis=0)

            # Predict
            preds = self.eye_model.predict(input_tensor, verbose=0)[0]
            pred_idx = int(np.argmax(preds))
            confidence = float(preds[pred_idx])
            label = self.eye_class_labels.get(pred_idx, "unknown")

            return {
                "available": True,
                "label": label,
                "confidence": round(confidence, 3),
                "probabilities": {
                    self.eye_class_labels.get(i, f"class_{i}"): round(float(preds[i]), 3)
                    for i in range(len(preds))
                }
            }
        except Exception as exc:
            logger.warning("Eye analysis error: %s", exc)
            return {"available": False, "error": str(exc)}

    # --------------------------------------------------------------------------
    # YOLO INFERENCE (Person & Object Detection)
    # --------------------------------------------------------------------------
    def analyze_yolo(self, image: Image.Image | np.ndarray) -> Dict[str, Any]:
        if not self._initialized:
            self.initialize()
        if not self.yolo_loaded or self.yolo_model is None:
            return {"available": False, "error": "YOLO model not loaded"}

        try:
            if isinstance(image, Image.Image):
                img_arr = np.array(image.convert("RGB"))
            else:
                img_arr = image

            results = self.yolo_model(img_arr, verbose=False)
            boxes = results[0].boxes

            person_count = 0
            detected_objects = []
            detections_list = []
            max_conf = 0.0

            if boxes is not None and len(boxes) > 0:
                for box in boxes:
                    cls_id = int(box.cls[0].item())
                    conf = float(box.conf[0].item())
                    cls_name = self.yolo_model.names.get(cls_id, f"cls_{cls_id}")
                    if conf > max_conf:
                        max_conf = conf

                    xyxy = box.xyxy[0].tolist()
                    detections_list.append({
                        "class": cls_name,
                        "confidence": round(conf, 3),
                        "bbox": [round(x, 1) for x in xyxy]
                    })

                    if cls_name == "person":
                        person_count += 1
                    else:
                        if cls_name not in detected_objects:
                            detected_objects.append(cls_name)

            alerts = []
            if person_count > 1:
                alerts.append("multiple_people_detected")
            elif person_count == 0:
                alerts.append("face_not_detected")

            # Check secondary devices/objects of interest
            prohibited_objects = {"cell phone", "laptop", "tv", "book"}
            found_prohibited = [o for o in detected_objects if o in prohibited_objects]
            if found_prohibited:
                alerts.append(f"detected_{'_'.join(found_prohibited)}")

            return {
                "available": True,
                "persons": person_count,
                "objects": detected_objects,
                "confidence": round(max_conf if max_conf > 0 else 0.85, 3),
                "detections": detections_list,
                "alerts": alerts
            }
        except Exception as exc:
            logger.warning("YOLO analysis error: %s", exc)
            return {"available": False, "error": str(exc)}

    # --------------------------------------------------------------------------
    # COMBINED ANALYSIS (Image + Audio)
    # --------------------------------------------------------------------------
    def analyze_interview_telemetry(
        self,
        interview_id: str,
        candidate_id: str,
        image_bytes: Optional[bytes] = None,
        audio_bytes: Optional[bytes] = None
    ) -> Dict[str, Any]:
        ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        # 1. Process Image (Eye + YOLO)
        eye_result = {"available": False, "label": "unavailable", "confidence": 0.0}
        yolo_result = {"available": False, "persons": 1, "objects": [], "confidence": 0.0, "alerts": []}

        if image_bytes:
            try:
                pil_img = Image.open(io.BytesIO(image_bytes))
                yolo_result = self.analyze_yolo(pil_img)
                eye_result = self.analyze_eye(pil_img)
            except Exception as e:
                logger.warning("Failed to decode image bytes: %s", e)

        # 2. Process Audio
        voice_result = {"available": False, "label": "unavailable", "confidence": 0.0}
        if audio_bytes:
            voice_result = self.analyze_voice(audio_bytes)

        # Aggregate alerts
        all_alerts = list(yolo_result.get("alerts", []))
        if eye_result.get("label") == "looking_away" and eye_result.get("confidence", 0) > 0.75:
            all_alerts.append("gaze_unfocused")
        elif eye_result.get("label") == "eyes_closed" and eye_result.get("confidence", 0) > 0.80:
            all_alerts.append("eyes_closed")

        return {
            "interview_id": interview_id,
            "candidate_id": candidate_id,
            "timestamp": ts,
            "eye_detection": eye_result,
            "voice_detection": voice_result,
            "object_detection": yolo_result,
            "alerts": all_alerts
        }


def get_ml_service() -> MLService:
    global _ml_instance
    if _ml_instance is None:
        with _ml_lock:
            if _ml_instance is None:
                _ml_instance = MLService()
                _ml_instance.initialize()
    return _ml_instance
