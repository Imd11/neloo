"""
Layout Detector - YOLOv10 based document layout detection
Ported from SmartResume with simplifications
"""

import os
from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np

try:
    import onnxruntime as ort

    ONNX_AVAILABLE = True
except ImportError:
    ONNX_AVAILABLE = False


@dataclass
class LayoutBox:
    """A detected layout region"""

    x1: int
    y1: int
    x2: int
    y2: int
    score: float
    label: str = "text_block"


class LayoutDetector:
    """
    ONNX-based YOLOv10 layout detector for documents

    Detects text blocks, headers, lists, etc. for improved reading order
    """

    # Label mapping for resume layout detection
    LABELS = {
        0: "text_block",
        1: "header",
        2: "list_item",
        3: "table",
        4: "figure",
    }

    def __init__(self, model_path: Optional[str] = None):
        """
        Initialize layout detector

        Args:
            model_path: Path to ONNX model file. If None, will look in default locations.
        """
        self.session = None
        self.input_name = None
        self.output_names = None
        self.input_size = 640
        self.conf_threshold = 0.5

        if model_path is None:
            model_path = self._find_model()

        if model_path and os.path.exists(model_path):
            self._load_model(model_path)
        else:
            print("⚠️ Layout model not found. Layout detection will be disabled.")
            print("   To enable, download YOLOv10 model to: models/yolov10/best.onnx")

    def _find_model(self) -> Optional[str]:
        """Find model in default locations, download if not found"""
        possible_paths = [
            "models/yolov10/best.onnx",
            "../models/yolov10/best.onnx",
            os.path.join(os.path.dirname(__file__), "models", "yolov10", "best.onnx"),
        ]

        for path in possible_paths:
            if os.path.exists(path):
                return path

        # Try to download from Hugging Face
        default_path = os.path.join(os.path.dirname(__file__), "models", "yolov10", "best.onnx")
        if self._download_model(default_path):
            return default_path

        return None

    def _download_model(self, target_path: str) -> bool:
        """Download model from Hugging Face Hub"""
        try:
            # Model URL from Alibaba-EI/SmartResume official repo
            model_url = (
                "https://huggingface.co/Alibaba-EI/SmartResume/resolve/main/yolov10/best.onnx"
            )

            print("📥 Downloading layout model from Hugging Face (Alibaba-EI/SmartResume)...")

            import urllib.request

            # Create directory if not exists
            os.makedirs(os.path.dirname(target_path), exist_ok=True)

            # Download with progress
            urllib.request.urlretrieve(model_url, target_path)

            print(f"✅ Model downloaded to: {target_path}")
            return True

        except Exception as e:
            print(f"⚠️ Failed to download model: {e}")
            print("   Layout detection will be disabled.")
            return False

    def _load_model(self, model_path: str):
        """Load ONNX model"""
        if not ONNX_AVAILABLE:
            print("⚠️ onnxruntime not installed. Install with: pip install onnxruntime")
            return

        try:
            # Use CPU provider for compatibility
            providers = ["CPUExecutionProvider"]

            self.session = ort.InferenceSession(model_path, providers=providers)
            self.input_name = self.session.get_inputs()[0].name
            self.output_names = [out.name for out in self.session.get_outputs()]

            print(f"✅ Layout detector loaded: {model_path}")
            print(f"   Input: {self.session.get_inputs()[0].shape}")

        except Exception as e:
            print(f"❌ Failed to load layout model: {e}")
            self.session = None

    @property
    def is_available(self) -> bool:
        """Check if layout detector is ready"""
        return self.session is not None

    def detect(self, image: np.ndarray, conf_threshold: float = 0.5) -> List[LayoutBox]:
        """
        Detect layout regions in image

        Args:
            image: RGB image as numpy array (H, W, C)
            conf_threshold: Confidence threshold

        Returns:
            List of LayoutBox objects
        """
        if not self.is_available:
            return []

        # Preprocess
        input_tensor, scale = self._preprocess(image)

        # Inference
        try:
            outputs = self.session.run(self.output_names, {self.input_name: input_tensor})
        except Exception as e:
            print(f"❌ Layout detection failed: {e}")
            return []

        # Postprocess
        boxes = self._postprocess(outputs, scale, conf_threshold)

        return boxes

    def _preprocess(self, image: np.ndarray) -> Tuple[np.ndarray, float]:
        """Preprocess image for ONNX inference"""
        import cv2

        # Ensure RGB
        if len(image.shape) == 3 and image.shape[2] == 3:
            if image.dtype != np.uint8:
                image = (image * 255).astype(np.uint8)

        h, w = image.shape[:2]
        scale = self.input_size / max(h, w)
        new_h, new_w = int(h * scale), int(w * scale)

        # Resize
        resized = cv2.resize(image, (new_w, new_h))

        # Pad to square
        padded = np.zeros((self.input_size, self.input_size, 3), dtype=np.uint8)
        padded[:new_h, :new_w] = resized

        # Normalize and transpose
        normalized = padded.astype(np.float32) / 255.0
        tensor = np.transpose(normalized, (2, 0, 1))
        tensor = np.expand_dims(tensor, axis=0)

        return tensor, scale

    def _postprocess(
        self, outputs: List[np.ndarray], scale: float, conf_threshold: float
    ) -> List[LayoutBox]:
        """Postprocess ONNX output to LayoutBox list"""
        if not outputs:
            return []

        output = outputs[0]

        # Handle different output shapes
        if len(output.shape) == 3:
            output = output[0]  # Remove batch dimension

        boxes = []
        for detection in output:
            # Format: [x_center, y_center, width, height, confidence, ...]
            if len(detection) >= 5:
                x_center, y_center, width, height, confidence = detection[:5]

                if confidence > conf_threshold:
                    # Convert to corner coordinates
                    x1 = int((x_center - width / 2) / scale)
                    y1 = int((y_center - height / 2) / scale)
                    x2 = int((x_center + width / 2) / scale)
                    y2 = int((y_center + height / 2) / scale)

                    # Get label if available
                    label_idx = int(detection[5]) if len(detection) > 5 else 0
                    label = self.LABELS.get(label_idx, "text_block")

                    boxes.append(
                        LayoutBox(
                            x1=max(0, x1),
                            y1=max(0, y1),
                            x2=x2,
                            y2=y2,
                            score=float(confidence),
                            label=label,
                        )
                    )

        # Sort by Y position (top to bottom)
        boxes.sort(key=lambda b: (b.y1, b.x1))

        return boxes


def convert_pdf_page_to_image(
    pdf_bytes: bytes, page_num: int = 0, dpi: int = 150
) -> Optional[np.ndarray]:
    """
    Convert a PDF page to image for layout detection

    Args:
        pdf_bytes: PDF file content
        page_num: Page number (0-indexed)
        dpi: Resolution for rendering

    Returns:
        RGB image as numpy array, or None if failed
    """
    try:
        import fitz  # PyMuPDF

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if page_num >= len(doc):
            return None

        page = doc[page_num]
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat)

        # Convert to numpy array
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)

        # Convert to RGB if necessary
        if pix.n == 4:  # RGBA
            img = img[:, :, :3]

        doc.close()
        return img

    except ImportError:
        print("⚠️ PyMuPDF not installed. Install with: pip install pymupdf")
        return None
    except Exception as e:
        print(f"❌ PDF to image conversion failed: {e}")
        return None
