// File sinh tự động bởi assets/cast/split.py — không sửa tay.
// Tọa độ tính bằng pixel của ảnh gốc assets/cast/<id>/source.png.
import type { CharacterRig } from "./rig";

export const CAST_RIGS: Record<string, CharacterRig> = {
  "mai": {
    "dir": "fedtoon/cast/mai",
    "units": 320,
    "feetY": 1492,
    "top": 51,
    "centerX": 560,
    "parts": {
      "head": {
        "x": 247,
        "y": 50,
        "w": 572,
        "h": 511
      },
      "arm-l-lower": {
        "x": 52,
        "y": 569,
        "w": 358,
        "h": 267
      },
      "arm-l-upper": {
        "x": 340,
        "y": 621,
        "w": 176,
        "h": 212
      },
      "arm-r": {
        "x": 706,
        "y": 642,
        "w": 175,
        "h": 447
      },
      "hair-back": {
        "x": 263,
        "y": 557,
        "w": 540,
        "h": 361
      },
      "body": {
        "x": 248,
        "y": 470,
        "w": 548,
        "h": 1024
      },
      "mouth": {
        "x": 559,
        "y": 400,
        "w": 134,
        "h": 103
      },
      "brow-0": {
        "x": 464,
        "y": 244,
        "w": 78,
        "h": 48
      },
      "brow-1": {
        "x": 637,
        "y": 219,
        "w": 74,
        "h": 29
      }
    },
    "head": {
      "pivot": [
        595,
        560
      ]
    },
    "arms": [
      {
        "side": "left",
        "kind": "raised",
        "segments": [
          {
            "part": "arm-l-upper",
            "pivot": [
              455,
              705
            ]
          },
          {
            "part": "arm-l-lower",
            "pivot": [
              347,
              764
            ]
          }
        ]
      },
      {
        "side": "right",
        "kind": "hanging",
        "segments": [
          {
            "part": "arm-r",
            "pivot": [
              746,
              718
            ]
          }
        ]
      }
    ],
    "order": [
      "hair-back",
      "arm:0",
      "arm:1",
      "body",
      "head"
    ],
    "eyes": [
      {
        "cx": 528,
        "cy": 353,
        "rx": 44,
        "ry": 45
      },
      {
        "cx": 692,
        "cy": 321,
        "rx": 40,
        "ry": 43
      }
    ],
    "mouthTop": [
      561,
      420,
      691,
      402
    ],
    "brows": [
      "brow-0",
      "brow-1"
    ],
    "colors": {
      "skin": "#FDB98C",
      "hair": "#101536",
      "shirt": "#FD3263",
      "mouth": "#8B0108",
      "tongue": "#FD4A48",
      "pupil": "#08080D"
    },
    "lid": {
      "margin": 3,
      "line": true
    }
  }
};
