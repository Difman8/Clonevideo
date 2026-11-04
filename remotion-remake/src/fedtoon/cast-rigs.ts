// File sinh tự động bởi assets/cast/split.py — không sửa tay.
// Tọa độ tính bằng pixel của ảnh gốc assets/cast/<id>/source.png.
import type { CharacterRig } from "./rig";

export const CAST_RIGS: Record<string, CharacterRig> = {
  "grandpa": {
    "dir": "fedtoon/cast/grandpa",
    "units": 315,
    "feetY": 1443,
    "top": 97,
    "centerX": 505,
    "parts": {
      "head": {
        "x": 264,
        "y": 96,
        "w": 488,
        "h": 413
      },
      "arm-r": {
        "x": 615,
        "y": 127,
        "w": 317,
        "h": 491
      },
      "arm-l": {
        "x": 92,
        "y": 124,
        "w": 315,
        "h": 494
      },
      "body": {
        "x": 241,
        "y": 419,
        "w": 527,
        "h": 1026
      },
      "mouth": {
        "x": 485,
        "y": 359,
        "w": 145,
        "h": 109
      },
      "brow-0": {
        "x": 400,
        "y": 203,
        "w": 72,
        "h": 49
      },
      "brow-1": {
        "x": 584,
        "y": 179,
        "w": 65,
        "h": 30
      }
    },
    "head": {
      "pivot": [
        530,
        505
      ]
    },
    "arms": [
      {
        "side": "right",
        "kind": "raised",
        "segments": [
          {
            "part": "arm-r",
            "pivot": [
              668,
              565
            ]
          }
        ],
        "rest": [
          -138
        ],
        "cap": [
          675,
          640,
          72,
          150
        ]
      },
      {
        "side": "left",
        "kind": "raised",
        "segments": [
          {
            "part": "arm-l",
            "pivot": [
              352,
              565
            ]
          }
        ],
        "rest": [
          -138
        ],
        "cap": [
          345,
          640,
          72,
          150
        ]
      }
    ],
    "order": [
      "arm:0",
      "arm:1",
      "body",
      "head"
    ],
    "eyes": [
      {
        "cx": 471,
        "cy": 307,
        "rx": 29,
        "ry": 33
      },
      {
        "cx": 623,
        "cy": 284,
        "rx": 27,
        "ry": 32
      }
    ],
    "mouthTop": [
      489,
      382,
      627,
      362
    ],
    "brows": [
      "brow-0",
      "brow-1"
    ],
    "colors": {
      "skin": "#FDC094",
      "hair": "#FEFEFE",
      "shirt": "#0E2674",
      "mouth": "#700102",
      "tongue": "#FD433D",
      "pupil": "#000000"
    },
    "lid": {
      "margin": 2,
      "line": false
    },
    "drawnAction": "cheer",
    "mouthStyle": {
      "drawn": "happy",
      "open": true
    }
  },
  "kid": {
    "dir": "fedtoon/cast/kid",
    "units": 300,
    "feetY": 1458,
    "top": 90,
    "centerX": 515,
    "parts": {
      "arm-r-lower": {
        "x": 668,
        "y": 294,
        "w": 223,
        "h": 359
      },
      "arm-r-upper": {
        "x": 662,
        "y": 599,
        "w": 229,
        "h": 168
      },
      "arm-l": {
        "x": 215,
        "y": 652,
        "w": 201,
        "h": 455
      },
      "head": {
        "x": 246,
        "y": 89,
        "w": 457,
        "h": 500
      },
      "body": {
        "x": 299,
        "y": 500,
        "w": 491,
        "h": 960
      },
      "mouth": {
        "x": 526,
        "y": 465,
        "w": 87,
        "h": 33
      },
      "brow-0": {
        "x": 405,
        "y": 320,
        "w": 76,
        "h": 49
      },
      "brow-1": {
        "x": 572,
        "y": 291,
        "w": 72,
        "h": 29
      }
    },
    "head": {
      "pivot": [
        530,
        585
      ]
    },
    "arms": [
      {
        "side": "right",
        "kind": "raised",
        "segments": [
          {
            "part": "arm-r-upper",
            "pivot": [
              705,
              700
            ]
          },
          {
            "part": "arm-r-lower",
            "pivot": [
              840,
              605
            ],
            "front": true
          }
        ]
      },
      {
        "side": "left",
        "kind": "hanging",
        "segments": [
          {
            "part": "arm-l",
            "pivot": [
              366,
              736
            ]
          }
        ]
      }
    ],
    "order": [
      "arm:0",
      "arm:1",
      "body",
      "head",
      "arm:0:front"
    ],
    "eyes": [
      {
        "cx": 471,
        "cy": 414,
        "rx": 39,
        "ry": 39
      },
      {
        "cx": 623,
        "cy": 381,
        "rx": 35,
        "ry": 39
      }
    ],
    "mouthTop": [
      530,
      470,
      610,
      470
    ],
    "brows": [
      "brow-0",
      "brow-1"
    ],
    "colors": {
      "skin": "#FDC59C",
      "hair": "#FEBB06",
      "shirt": "#01BDBC",
      "mouth": "#7A0C14",
      "tongue": "#F04950",
      "pupil": "#08070B",
      "line": "#0A0B0E"
    },
    "lid": {
      "margin": 3,
      "line": true
    },
    "drawnAction": "think",
    "mouthStyle": {
      "drawn": "neutral",
      "open": false
    }
  },
  "man": {
    "dir": "fedtoon/cast/man",
    "units": 320,
    "feetY": 1403,
    "top": 51,
    "centerX": 508,
    "parts": {
      "arm-r-lower": {
        "x": 680,
        "y": 208,
        "w": 292,
        "h": 347
      },
      "arm-r-upper": {
        "x": 577,
        "y": 462,
        "w": 212,
        "h": 203
      },
      "arm-l": {
        "x": 191,
        "y": 559,
        "w": 231,
        "h": 489
      },
      "head": {
        "x": 236,
        "y": 50,
        "w": 517,
        "h": 499
      },
      "body": {
        "x": 284,
        "y": 457,
        "w": 445,
        "h": 948
      },
      "mouth": {
        "x": 522,
        "y": 414,
        "w": 92,
        "h": 42
      },
      "brow-0": {
        "x": 428,
        "y": 221,
        "w": 74,
        "h": 40
      },
      "brow-1": {
        "x": 589,
        "y": 212,
        "w": 69,
        "h": 30
      }
    },
    "head": {
      "pivot": [
        518,
        546
      ]
    },
    "arms": [
      {
        "side": "right",
        "kind": "raised",
        "segments": [
          {
            "part": "arm-r-upper",
            "pivot": [
              630,
              605
            ]
          },
          {
            "part": "arm-r-lower",
            "pivot": [
              735,
              500
            ]
          }
        ],
        "rest": [
          -114,
          0
        ],
        "point": [
          -49,
          0
        ],
        "cap": [
          626,
          598,
          62,
          72
        ]
      },
      {
        "side": "left",
        "kind": "hanging",
        "segments": [
          {
            "part": "arm-l",
            "pivot": [
              377,
              644
            ]
          }
        ]
      }
    ],
    "order": [
      "arm:0",
      "arm:1",
      "body",
      "head"
    ],
    "eyes": [
      {
        "cx": 480,
        "cy": 335,
        "rx": 35,
        "ry": 38
      },
      {
        "cx": 632,
        "cy": 320,
        "rx": 33,
        "ry": 35
      }
    ],
    "mouthTop": [
      525,
      450,
      612,
      450
    ],
    "brows": [
      "brow-0",
      "brow-1"
    ],
    "colors": {
      "skin": "#FDBE91",
      "hair": "#723B26",
      "shirt": "#2075FC",
      "mouth": "#7A0C14",
      "tongue": "#F04950",
      "pupil": "#0F101B",
      "line": "#130702"
    },
    "lid": {
      "margin": 2,
      "line": false
    },
    "drawnAction": "wave",
    "mouthStyle": {
      "drawn": "sad",
      "open": false
    }
  },
  "scientist": {
    "dir": "fedtoon/cast/scientist",
    "units": 320,
    "feetY": 1436,
    "top": 92,
    "centerX": 545,
    "parts": {
      "arm-l-lower": {
        "x": 59,
        "y": 582,
        "w": 332,
        "h": 158
      },
      "arm-l-upper": {
        "x": 331,
        "y": 609,
        "w": 172,
        "h": 134
      },
      "arm-r": {
        "x": 661,
        "y": 652,
        "w": 201,
        "h": 427
      },
      "head": {
        "x": 315,
        "y": 91,
        "w": 484,
        "h": 516
      },
      "body": {
        "x": 337,
        "y": 540,
        "w": 430,
        "h": 898
      },
      "mouth": {
        "x": 602,
        "y": 483,
        "w": 57,
        "h": 79
      },
      "brow-0": {
        "x": 475,
        "y": 330,
        "w": 77,
        "h": 45
      },
      "brow-1": {
        "x": 640,
        "y": 313,
        "w": 62,
        "h": 25
      }
    },
    "head": {
      "pivot": [
        590,
        602
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
              445,
              680
            ]
          },
          {
            "part": "arm-l-lower",
            "pivot": [
              330,
              676
            ]
          }
        ],
        "rest": [
          -75,
          0
        ],
        "cap": [
          450,
          684,
          48,
          60
        ]
      },
      {
        "side": "right",
        "kind": "hanging",
        "segments": [
          {
            "part": "arm-r",
            "pivot": [
              700,
              713
            ]
          }
        ]
      }
    ],
    "order": [
      "arm:0",
      "arm:1",
      "body",
      "head"
    ],
    "eyes": [
      {
        "cx": 537,
        "cy": 428,
        "rx": 40,
        "ry": 43
      },
      {
        "cx": 688,
        "cy": 405,
        "rx": 34,
        "ry": 42
      }
    ],
    "mouthTop": [
      606,
      490,
      654,
      490
    ],
    "brows": [
      "brow-0",
      "brow-1"
    ],
    "colors": {
      "skin": "#E4935A",
      "hair": "#141432",
      "shirt": "#F2F2F2",
      "mouth": "#700403",
      "tongue": "#D52022",
      "pupil": "#0B0A0F"
    },
    "lid": {
      "margin": 3,
      "line": true
    },
    "drawnAction": "point",
    "mouthStyle": {
      "drawn": "surprised",
      "open": true
    }
  },
  "woman": {
    "dir": "fedtoon/cast/woman",
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
