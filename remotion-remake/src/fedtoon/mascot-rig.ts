// File sinh tự động bởi assets/mascot/split.py — không sửa tay.
// Tọa độ tính bằng pixel của ảnh linh vật gốc (assets/mascot/source.png).
export const MASCOT_RIG = {
  "parts": {
    "arm-down": {
      "x": 183,
      "y": 575,
      "w": 141,
      "h": 449
    },
    "arm-up": {
      "x": 586,
      "y": 417,
      "w": 289,
      "h": 284
    },
    "body": {
      "x": 225,
      "y": 412,
      "w": 456,
      "h": 1099
    },
    "head": {
      "x": 190,
      "y": 17,
      "w": 426,
      "h": 447
    },
    "avatar": {
      "x": 190,
      "y": 17,
      "w": 426,
      "h": 447
    },
    "mouth": {
      "x": 429,
      "y": 353,
      "w": 92,
      "h": 57
    },
    "brow-left": {
      "x": 344,
      "y": 209,
      "w": 76,
      "h": 50
    },
    "brow-right": {
      "x": 489,
      "y": 186,
      "w": 67,
      "h": 35
    }
  },
  "neck": [
    447,
    456
  ],
  "elbow": [
    634,
    667
  ],
  "shoulder": [
    286,
    596
  ],
  "feetY": 1506,
  "centerX": 452,
  "top": 17,
  "eyes": [
    {
      "cx": 410,
      "cy": 302,
      "rx": 19,
      "ry": 22
    },
    {
      "cx": 531,
      "cy": 281,
      "rx": 18,
      "ry": 21
    }
  ],
  "mouthTop": {
    "x0": 430,
    "y0": 367,
    "x1": 520,
    "y1": 355
  },
  "colors": {
    "skin": "#FD957D",
    "shirt": "#00B6B7",
    "pants": "#483081",
    "hair": "#1D285E",
    "mouth": "#9C1B26",
    "tongue": "#DF3E44",
    "pupil": "#1C1B32"
  }
} as const;
