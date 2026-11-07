// File sinh tự động bởi assets/cast/split.py — không sửa tay.
// Tọa độ tính bằng pixel của ảnh gốc assets/cast/<id>/source.png.
import type { CharacterRig } from "./rig";

export const CAST_RIGS: Record<string, CharacterRig> = {
  "grandpa": {
    "dir": "fedtoon/cast/grandpa",
    "units": 320,
    "feetY": 1483,
    "top": 75,
    "centerX": 510,
    "parts": {
      "head": {
        "x": 243,
        "y": 74,
        "w": 532,
        "h": 458
      },
      "arm-l": {
        "x": 231,
        "y": 613,
        "w": 174,
        "h": 449
      },
      "arm-r": {
        "x": 617,
        "y": 613,
        "w": 173,
        "h": 449
      },
      "body": {
        "x": 294,
        "y": 470,
        "w": 431,
        "h": 1016
      },
      "arm-l-seam": {
        "x": 307,
        "y": 652,
        "w": 73,
        "h": 295
      },
      "arm-r-seam": {
        "x": 641,
        "y": 652,
        "w": 74,
        "h": 295
      },
      "mouth": {
        "x": 433,
        "y": 391,
        "w": 154,
        "h": 103
      },
      "brow-0": {
        "x": 374,
        "y": 190,
        "w": 87,
        "h": 49
      },
      "brow-1": {
        "x": 560,
        "y": 189,
        "w": 87,
        "h": 49
      }
    },
    "head": {
      "pivot": [
        510,
        526
      ]
    },
    "arms": [
      {
        "side": "left",
        "kind": "hanging",
        "trim": true,
        "segments": [
          {
            "part": "arm-l",
            "pivot": [
              356,
              662
            ],
            "seam": {
              "part": "arm-l-seam",
              "reach": 286
            }
          }
        ]
      },
      {
        "side": "right",
        "kind": "hanging",
        "trim": true,
        "segments": [
          {
            "part": "arm-r",
            "pivot": [
              666,
              662
            ],
            "seam": {
              "part": "arm-r-seam",
              "reach": 286
            }
          }
        ]
      }
    ],
    "order": [
      "arm:0",
      "arm:1",
      "body",
      "arm:0:seam",
      "arm:1:seam",
      "head"
    ],
    "eyes": [
      {
        "cx": 430,
        "cy": 312,
        "rx": 31,
        "ry": 34
      },
      {
        "cx": 590,
        "cy": 312,
        "rx": 31,
        "ry": 34
      }
    ],
    "mouthTop": [
      440,
      397,
      580,
      397
    ],
    "brows": [
      "brow-0",
      "brow-1"
    ],
    "colors": {
      "skin": "#FDB487",
      "hair": "#FEFDFE",
      "shirt": "#0C2777",
      "mouth": "#780000",
      "tongue": "#FE443F",
      "pupil": "#000000"
    },
    "lid": {
      "margin": 2,
      "line": false
    },
    "mouthStyle": {
      "drawn": "happy",
      "open": true
    },
    "poses": {
      "cheer": "grandpa-cheer"
    }
  },
  "kid": {
    "dir": "fedtoon/cast/kid",
    "units": 300,
    "feetY": 1483,
    "top": 52,
    "centerX": 510,
    "parts": {
      "head": {
        "x": 266,
        "y": 51,
        "w": 491,
        "h": 509
      },
      "arm-l": {
        "x": 250,
        "y": 601,
        "w": 163,
        "h": 465
      },
      "arm-r": {
        "x": 613,
        "y": 602,
        "w": 157,
        "h": 464
      },
      "body": {
        "x": 319,
        "y": 512,
        "w": 384,
        "h": 974
      },
      "arm-l-bodyline": {
        "x": 339,
        "y": 693,
        "w": 47,
        "h": 289
      },
      "arm-r-bodyline": {
        "x": 641,
        "y": 846,
        "w": 39,
        "h": 135
      },
      "arm-r-edge": {
        "x": 623,
        "y": 652,
        "w": 78,
        "h": 201
      },
      "mouth": {
        "x": 467,
        "y": 443,
        "w": 91,
        "h": 24
      },
      "brow-0": {
        "x": 392,
        "y": 275,
        "w": 79,
        "h": 35
      },
      "brow-1": {
        "x": 553,
        "y": 275,
        "w": 79,
        "h": 35
      }
    },
    "head": {
      "pivot": [
        512,
        548
      ]
    },
    "arms": [
      {
        "side": "left",
        "kind": "hanging",
        "trim": false,
        "segments": [
          {
            "part": "arm-l",
            "pivot": [
              366,
              700
            ],
            "away": {
              "body": "arm-l-bodyline",
              "reach": 280
            }
          }
        ]
      },
      {
        "side": "right",
        "kind": "hanging",
        "trim": false,
        "segments": [
          {
            "part": "arm-r",
            "pivot": [
              660,
              700
            ],
            "away": {
              "body": "arm-r-bodyline",
              "arm": "arm-r-edge",
              "reach": 279
            }
          }
        ]
      }
    ],
    "order": [
      "arm:0",
      "arm:1",
      "body",
      "arm:0:bodyline",
      "arm:1:bodyline",
      "head"
    ],
    "eyes": [
      {
        "cx": 436,
        "cy": 375,
        "rx": 38,
        "ry": 38
      },
      {
        "cx": 590,
        "cy": 375,
        "rx": 38,
        "ry": 38
      }
    ],
    "mouthTop": [
      470,
      452,
      556,
      452
    ],
    "brows": [
      "brow-0",
      "brow-1"
    ],
    "colors": {
      "skin": "#FDBE94",
      "hair": "#935729",
      "shirt": "#01C0C1",
      "mouth": "#7A0C14",
      "tongue": "#F04950",
      "pupil": "#050505",
      "line": "#080605"
    },
    "lid": {
      "margin": 3,
      "line": true
    },
    "mouthStyle": {
      "drawn": "neutral",
      "open": false
    },
    "poses": {
      "think": "kid-think"
    }
  },
  "man": {
    "dir": "fedtoon/cast/man",
    "units": 320,
    "feetY": 1470,
    "top": 90,
    "centerX": 480,
    "parts": {
      "head": {
        "x": 250,
        "y": 89,
        "w": 469,
        "h": 472
      },
      "arm-r-lower": {
        "x": 619,
        "y": 611,
        "w": 350,
        "h": 190
      },
      "arm-r-upper": {
        "x": 559,
        "y": 631,
        "w": 125,
        "h": 169
      },
      "arm-l": {
        "x": 232,
        "y": 629,
        "w": 164,
        "h": 445
      },
      "body": {
        "x": 285,
        "y": 480,
        "w": 391,
        "h": 992
      },
      "arm-r-upper-seam": {
        "x": 595,
        "y": 690,
        "w": 20,
        "h": 92
      },
      "arm-l-seam": {
        "x": 316,
        "y": 690,
        "w": 54,
        "h": 271
      },
      "mouth": {
        "x": 447,
        "y": 471,
        "w": 92,
        "h": 55
      },
      "brow-0": {
        "x": 375,
        "y": 278,
        "w": 78,
        "h": 35
      },
      "brow-1": {
        "x": 539,
        "y": 278,
        "w": 77,
        "h": 35
      }
    },
    "head": {
      "pivot": [
        485,
        557
      ]
    },
    "arms": [
      {
        "side": "right",
        "kind": "raised",
        "trim": true,
        "segments": [
          {
            "part": "arm-r-upper",
            "pivot": [
              600,
              672
            ],
            "seam": {
              "part": "arm-r-upper-seam",
              "reach": 107
            }
          },
          {
            "part": "arm-r-lower",
            "pivot": [
              668,
              752
            ]
          }
        ]
      },
      {
        "side": "left",
        "kind": "hanging",
        "trim": true,
        "segments": [
          {
            "part": "arm-l",
            "pivot": [
              355,
              670
            ],
            "seam": {
              "part": "arm-l-seam",
              "reach": 292
            }
          }
        ]
      }
    ],
    "order": [
      "arm:0",
      "arm:1",
      "body",
      "arm:0:seam",
      "arm:1:seam",
      "head"
    ],
    "eyes": [
      {
        "cx": 417,
        "cy": 391,
        "rx": 37,
        "ry": 38
      },
      {
        "cx": 574,
        "cy": 391,
        "rx": 36,
        "ry": 38
      }
    ],
    "mouthTop": [
      450,
      476,
      538,
      474
    ],
    "brows": [
      "brow-0",
      "brow-1"
    ],
    "colors": {
      "skin": "#FEBD90",
      "hair": "#6F3925",
      "shirt": "#156DFC",
      "mouth": "#85080A",
      "tongue": "#F24044",
      "pupil": "#141213",
      "line": "#1E0E03"
    },
    "lid": {
      "margin": 2,
      "line": false
    },
    "drawnAction": [
      "shrug"
    ],
    "poses": {
      "wave": "man-wave",
      "cheer": "man-wave"
    },
    "shoulderShare": 0,
    "elbowRange": [
      -2,
      40
    ]
  },
  "scientist": {
    "dir": "fedtoon/cast/scientist",
    "units": 320,
    "feetY": 1490,
    "top": 44,
    "centerX": 512,
    "parts": {
      "head": {
        "x": 295,
        "y": 43,
        "w": 431,
        "h": 511
      },
      "arm-l": {
        "x": 267,
        "y": 637,
        "w": 180,
        "h": 432
      },
      "arm-r": {
        "x": 573,
        "y": 637,
        "w": 183,
        "h": 432
      },
      "body": {
        "x": 302,
        "y": 187,
        "w": 412,
        "h": 1305
      },
      "arm-l-seam": {
        "x": 337,
        "y": 693,
        "w": 60,
        "h": 270
      },
      "arm-r-seam": {
        "x": 625,
        "y": 694,
        "w": 56,
        "h": 269
      },
      "mouth": {
        "x": 483,
        "y": 448,
        "w": 57,
        "h": 72
      },
      "brow-0": {
        "x": 401,
        "y": 287,
        "w": 75,
        "h": 34
      },
      "brow-1": {
        "x": 549,
        "y": 287,
        "w": 75,
        "h": 31
      }
    },
    "head": {
      "pivot": [
        512,
        550
      ]
    },
    "arms": [
      {
        "side": "left",
        "kind": "hanging",
        "trim": true,
        "segments": [
          {
            "part": "arm-l",
            "pivot": [
              400,
              684
            ],
            "seam": {
              "part": "arm-l-seam",
              "reach": 283
            }
          }
        ]
      },
      {
        "side": "right",
        "kind": "hanging",
        "trim": true,
        "segments": [
          {
            "part": "arm-r",
            "pivot": [
              620,
              684
            ],
            "seam": {
              "part": "arm-r-seam",
              "reach": 283
            }
          }
        ]
      }
    ],
    "order": [
      "arm:0",
      "arm:1",
      "body",
      "arm:0:seam",
      "arm:1:seam",
      "head"
    ],
    "eyes": [
      {
        "cx": 441,
        "cy": 387,
        "rx": 38,
        "ry": 40
      },
      {
        "cx": 583,
        "cy": 387,
        "rx": 37,
        "ry": 40
      }
    ],
    "mouthTop": [
      489,
      455,
      533,
      455
    ],
    "brows": [
      "brow-0",
      "brow-1"
    ],
    "colors": {
      "skin": "#E69B64",
      "hair": "#181A38",
      "shirt": "#F1F1F0",
      "mouth": "#740605",
      "tongue": "#DB2726",
      "pupil": "#08080A"
    },
    "lid": {
      "margin": 3,
      "line": true
    },
    "mouthStyle": {
      "drawn": "surprised",
      "open": true
    },
    "poses": {
      "point": "scientist-point",
      "wave": "scientist-point",
      "cheer": "scientist-point"
    }
  },
  "woman": {
    "dir": "fedtoon/cast/woman",
    "units": 320,
    "feetY": 1486,
    "top": 50,
    "centerX": 512,
    "parts": {
      "head": {
        "x": 253,
        "y": 49,
        "w": 516,
        "h": 512
      },
      "arm-l": {
        "x": 239,
        "y": 663,
        "w": 164,
        "h": 424
      },
      "arm-r": {
        "x": 615,
        "y": 663,
        "w": 168,
        "h": 424
      },
      "hair-back": {
        "x": 274,
        "y": 557,
        "w": 467,
        "h": 169
      },
      "body": {
        "x": 270,
        "y": 440,
        "w": 476,
        "h": 1048
      },
      "arm-l-seam": {
        "x": 318,
        "y": 704,
        "w": 54,
        "h": 287
      },
      "arm-r-seam": {
        "x": 648,
        "y": 705,
        "w": 56,
        "h": 287
      },
      "mouth": {
        "x": 445,
        "y": 408,
        "w": 134,
        "h": 92
      },
      "brow-0": {
        "x": 389,
        "y": 239,
        "w": 81,
        "h": 38
      },
      "brow-1": {
        "x": 555,
        "y": 238,
        "w": 82,
        "h": 38
      }
    },
    "head": {
      "pivot": [
        512,
        552
      ]
    },
    "arms": [
      {
        "side": "left",
        "kind": "hanging",
        "trim": true,
        "segments": [
          {
            "part": "arm-l",
            "pivot": [
              356,
              710
            ],
            "seam": {
              "part": "arm-l-seam",
              "reach": 280
            }
          }
        ]
      },
      {
        "side": "right",
        "kind": "hanging",
        "trim": true,
        "segments": [
          {
            "part": "arm-r",
            "pivot": [
              662,
              710
            ],
            "seam": {
              "part": "arm-r-seam",
              "reach": 281
            }
          }
        ]
      }
    ],
    "order": [
      "hair-back",
      "arm:0",
      "arm:1",
      "body",
      "arm:0:seam",
      "arm:1:seam",
      "head"
    ],
    "eyes": [
      {
        "cx": 432,
        "cy": 344,
        "rx": 41,
        "ry": 44
      },
      {
        "cx": 592,
        "cy": 344,
        "rx": 41,
        "ry": 44
      }
    ],
    "mouthTop": [
      452,
      414,
      572,
      414
    ],
    "brows": [
      "brow-0",
      "brow-1"
    ],
    "colors": {
      "skin": "#FEBA8D",
      "hair": "#13193D",
      "shirt": "#FD2A64",
      "mouth": "#8A0107",
      "tongue": "#FE3946",
      "pupil": "#0B0B0B"
    },
    "lid": {
      "margin": 3,
      "line": true
    },
    "poses": {
      "point": "woman-present",
      "wave": "woman-present",
      "cheer": "woman-present"
    }
  },
  "man-wave": {
    "dir": "fedtoon/cast/man-wave",
    "units": 296,
    "feetY": 1403,
    "top": 51,
    "centerX": 508,
    "parts": {
      "arm-r-lower": {
        "x": 679,
        "y": 208,
        "w": 293,
        "h": 359
      },
      "arm-r-upper": {
        "x": 577,
        "y": 462,
        "w": 212,
        "h": 203
      },
      "arm-l": {
        "x": 191,
        "y": 599,
        "w": 231,
        "h": 449
      },
      "head": {
        "x": 236,
        "y": 50,
        "w": 517,
        "h": 499
      },
      "body": {
        "x": 226,
        "y": 457,
        "w": 503,
        "h": 948
      },
      "arm-l-seam": {
        "x": 318,
        "y": 665,
        "w": 96,
        "h": 271
      },
      "mouth": {
        "x": 517,
        "y": 400,
        "w": 91,
        "h": 59
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
              742,
              504
            ]
          }
        ],
        "trim": true
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
            ],
            "seam": {
              "part": "arm-l-seam",
              "reach": 296
            }
          }
        ],
        "trim": true
      }
    ],
    "order": [
      "arm:0",
      "arm:1",
      "body",
      "arm:1:seam",
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
      520.2,
      413.3,
      605.2,
      403.0
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
    "drawnAction": [
      "wave",
      "cheer"
    ]
  },
  "scientist-point": {
    "dir": "fedtoon/cast/scientist-point",
    "units": 278,
    "feetY": 1436,
    "top": 92,
    "centerX": 545,
    "parts": {
      "arm-l-lower": {
        "x": 59,
        "y": 582,
        "w": 340,
        "h": 159
      },
      "arm-l-upper": {
        "x": 331,
        "y": 609,
        "w": 172,
        "h": 134
      },
      "arm-r": {
        "x": 661,
        "y": 674,
        "w": 201,
        "h": 405
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
        "w": 446,
        "h": 898
      },
      "arm-r-seam": {
        "x": 726,
        "y": 795,
        "w": 43,
        "h": 201
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
              332,
              674
            ]
          }
        ],
        "trim": true
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
            ],
            "seam": {
              "part": "arm-r-seam",
              "reach": 287
            }
          }
        ],
        "trim": true
      }
    ],
    "order": [
      "arm:0",
      "arm:1",
      "body",
      "arm:1:seam",
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
    "drawnAction": [
      "point",
      "wave",
      "cheer"
    ],
    "mouthStyle": {
      "drawn": "surprised",
      "open": true
    },
    "shoulderShare": 0,
    "elbowRange": [
      -6,
      20
    ]
  },
  "woman-present": {
    "dir": "fedtoon/cast/woman-present",
    "units": 316,
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
        "w": 361,
        "h": 264
      },
      "arm-l-upper": {
        "x": 340,
        "y": 625,
        "w": 176,
        "h": 208
      },
      "arm-r": {
        "x": 706,
        "y": 678,
        "w": 175,
        "h": 411
      },
      "hair-back": {
        "x": 263,
        "y": 557,
        "w": 540,
        "h": 359
      },
      "body": {
        "x": 248,
        "y": 470,
        "w": 548,
        "h": 1024
      },
      "arm-r-seam": {
        "x": 737,
        "y": 725,
        "w": 56,
        "h": 244
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
              346,
              766
            ]
          }
        ],
        "trim": true
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
            ],
            "seam": {
              "part": "arm-r-seam",
              "reach": 251
            }
          }
        ],
        "trim": true
      }
    ],
    "order": [
      "hair-back",
      "arm:0",
      "arm:1",
      "body",
      "arm:1:seam",
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
    },
    "drawnAction": [
      "point",
      "wave",
      "cheer"
    ],
    "shoulderShare": 0,
    "elbowRange": [
      0,
      16
    ]
  },
  "teen": {
    "dir": "fedtoon/cast/teen",
    "units": 320,
    "feetY": 1463,
    "top": 78,
    "centerX": 508,
    "parts": {
      "head": {
        "x": 239,
        "y": 77,
        "w": 538,
        "h": 502
      },
      "arm-l": {
        "x": 259,
        "y": 665,
        "w": 164,
        "h": 406
      },
      "arm-r": {
        "x": 601,
        "y": 667,
        "w": 157,
        "h": 404
      },
      "body": {
        "x": 320,
        "y": 351,
        "w": 421,
        "h": 1114
      },
      "hem": {
        "x": 348,
        "y": 933,
        "w": 322,
        "h": 26
      },
      "arm-l-seam": {
        "x": 349,
        "y": 701,
        "w": 38,
        "h": 240
      },
      "arm-r-seam": {
        "x": 633,
        "y": 701,
        "w": 37,
        "h": 240
      },
      "mouth": {
        "x": 462,
        "y": 477,
        "w": 101,
        "h": 36
      },
      "brow-0": {
        "x": 386,
        "y": 328,
        "w": 100,
        "h": 65
      },
      "brow-1": {
        "x": 537,
        "y": 327,
        "w": 99,
        "h": 67
      }
    },
    "head": {
      "pivot": [
        512,
        570
      ]
    },
    "arms": [
      {
        "side": "left",
        "kind": "hanging",
        "trim": true,
        "segments": [
          {
            "part": "arm-l",
            "pivot": [
              372,
              716
            ],
            "seam": {
              "part": "arm-l-seam",
              "reach": 222
            }
          }
        ]
      },
      {
        "side": "right",
        "kind": "hanging",
        "trim": true,
        "segments": [
          {
            "part": "arm-r",
            "pivot": [
              650,
              716
            ],
            "seam": {
              "part": "arm-r-seam",
              "reach": 222
            }
          }
        ]
      }
    ],
    "order": [
      "arm:0",
      "arm:1",
      "body",
      "out:hem",
      "arm:0:seam",
      "arm:1:seam",
      "head"
    ],
    "eyes": [
      {
        "cx": 432,
        "cy": 416,
        "rx": 34,
        "ry": 38
      },
      {
        "cx": 592,
        "cy": 416,
        "rx": 33,
        "ry": 38
      }
    ],
    "mouthTop": [
      466,
      500,
      558,
      500
    ],
    "brows": [
      "brow-0",
      "brow-1"
    ],
    "colors": {
      "skin": "#DA7943",
      "hair": "#101123",
      "shirt": "#FEB100",
      "mouth": "#7A0C14",
      "tongue": "#F04950",
      "pupil": "#0D0D10",
      "line": "#0E0C0D"
    },
    "lid": {
      "margin": 2,
      "line": false
    },
    "mouthStyle": {
      "drawn": "angry",
      "open": false
    },
    "poses": {
      "walk": "teen-walk"
    },
    "faceBase": "angry"
  },
  "teen-walk": {
    "dir": "fedtoon/cast/teen-walk",
    "units": 302,
    "feetY": 1392,
    "top": 57,
    "centerX": 555,
    "parts": {
      "head": {
        "x": 275,
        "y": 56,
        "w": 554,
        "h": 517
      },
      "body": {
        "x": 177,
        "y": 320,
        "w": 710,
        "h": 1074
      },
      "mouth": {
        "x": 602,
        "y": 450,
        "w": 91,
        "h": 38
      },
      "brow-0": {
        "x": 505,
        "y": 301,
        "w": 105,
        "h": 59
      },
      "brow-1": {
        "x": 667,
        "y": 284,
        "w": 79,
        "h": 63
      }
    },
    "head": {
      "pivot": [
        630,
        565
      ]
    },
    "arms": [],
    "order": [
      "body",
      "head"
    ],
    "eyes": [
      {
        "cx": 557,
        "cy": 383,
        "rx": 35,
        "ry": 35
      },
      {
        "cx": 710,
        "cy": 369,
        "rx": 30,
        "ry": 35
      }
    ],
    "mouthTop": [
      602,
      476,
      694,
      476
    ],
    "brows": [
      "brow-0",
      "brow-1"
    ],
    "colors": {
      "skin": "#CE7343",
      "hair": "#101123",
      "shirt": "#FEB100",
      "mouth": "#7A0C14",
      "tongue": "#F04950",
      "pupil": "#0D0D10",
      "line": "#0E0C0D"
    },
    "lid": {
      "margin": 2,
      "line": false
    },
    "drawnAction": [
      "walk"
    ],
    "mouthStyle": {
      "drawn": "angry",
      "open": false
    },
    "faceBase": "angry"
  },
  "boy": {
    "dir": "fedtoon/cast/boy",
    "units": 320,
    "feetY": 1488,
    "top": 69,
    "centerX": 512,
    "parts": {
      "head": {
        "x": 268,
        "y": 68,
        "w": 521,
        "h": 502
      },
      "arm-l": {
        "x": 267,
        "y": 651,
        "w": 170,
        "h": 425
      },
      "arm-r": {
        "x": 583,
        "y": 651,
        "w": 171,
        "h": 425
      },
      "body": {
        "x": 328,
        "y": 520,
        "w": 366,
        "h": 971
      },
      "arm-l-seam": {
        "x": 348,
        "y": 698,
        "w": 51,
        "h": 243
      },
      "arm-r-seam": {
        "x": 622,
        "y": 698,
        "w": 51,
        "h": 243
      },
      "mouth": {
        "x": 484,
        "y": 464,
        "w": 79,
        "h": 24
      },
      "brow-0": {
        "x": 397,
        "y": 292,
        "w": 89,
        "h": 42
      },
      "brow-1": {
        "x": 565,
        "y": 285,
        "w": 80,
        "h": 32
      }
    },
    "head": {
      "pivot": [
        512,
        560
      ]
    },
    "arms": [
      {
        "side": "left",
        "kind": "hanging",
        "trim": true,
        "segments": [
          {
            "part": "arm-l",
            "pivot": [
              388,
              700
            ],
            "seam": {
              "part": "arm-l-seam",
              "reach": 243
            }
          }
        ]
      },
      {
        "side": "right",
        "kind": "hanging",
        "trim": true,
        "segments": [
          {
            "part": "arm-r",
            "pivot": [
              632,
              700
            ],
            "seam": {
              "part": "arm-r-seam",
              "reach": 243
            }
          }
        ]
      }
    ],
    "order": [
      "arm:0",
      "arm:1",
      "body",
      "arm:0:seam",
      "arm:1:seam",
      "head"
    ],
    "eyes": [
      {
        "cx": 442,
        "cy": 392,
        "rx": 40,
        "ry": 40
      },
      {
        "cx": 602,
        "cy": 390,
        "rx": 39,
        "ry": 40
      }
    ],
    "mouthTop": [
      488,
      474,
      560,
      474
    ],
    "brows": [
      "brow-0",
      "brow-1"
    ],
    "colors": {
      "skin": "#FDBB8A",
      "hair": "#0F1229",
      "shirt": "#42CC3D",
      "mouth": "#7A0C14",
      "tongue": "#F04950",
      "pupil": "#000000",
      "line": "#040301"
    },
    "lid": {
      "margin": 3,
      "line": true
    },
    "mouthStyle": {
      "drawn": "neutral",
      "open": false
    },
    "poses": {
      "jump": "boy-think",
      "think": "boy-think"
    }
  },
  "boy-think": {
    "dir": "fedtoon/cast/boy-think",
    "units": 270,
    "feetY": 1351,
    "top": 164,
    "centerX": 485,
    "parts": {
      "hand": {
        "x": 588,
        "y": 566,
        "w": 138,
        "h": 161
      },
      "head": {
        "x": 264,
        "y": 163,
        "w": 525,
        "h": 481
      },
      "body": {
        "x": 163,
        "y": 491,
        "w": 644,
        "h": 862
      },
      "mouth": {
        "x": 560,
        "y": 510,
        "w": 73,
        "h": 24
      },
      "brow-0": {
        "x": 436,
        "y": 353,
        "w": 85,
        "h": 46
      },
      "brow-1": {
        "x": 607,
        "y": 336,
        "w": 71,
        "h": 30
      }
    },
    "head": {
      "pivot": [
        540,
        640
      ]
    },
    "arms": [],
    "order": [
      "body",
      "head",
      "hand"
    ],
    "eyes": [
      {
        "cx": 496,
        "cy": 447,
        "rx": 36,
        "ry": 36
      },
      {
        "cx": 648,
        "cy": 426,
        "rx": 30,
        "ry": 35
      }
    ],
    "mouthTop": [
      562,
      522,
      630,
      518
    ],
    "brows": [
      "brow-0",
      "brow-1"
    ],
    "colors": {
      "skin": "#FDC395",
      "hair": "#0E1228",
      "shirt": "#4BC94E",
      "mouth": "#7A0C14",
      "tongue": "#F04950",
      "pupil": "#000000",
      "line": "#040301"
    },
    "lid": {
      "margin": 3,
      "line": true
    },
    "drawnAction": [
      "jump",
      "think"
    ],
    "mouthStyle": {
      "drawn": "thinking",
      "open": false
    }
  },
  "kid-think": {
    "dir": "fedtoon/cast/kid-think",
    "units": 297,
    "feetY": 1458,
    "top": 90,
    "centerX": 515,
    "parts": {
      "hand": {
        "x": 668,
        "y": 294,
        "w": 168,
        "h": 222
      },
      "head": {
        "x": 246,
        "y": 89,
        "w": 485,
        "h": 497
      },
      "body": {
        "x": 215,
        "y": 445,
        "w": 676,
        "h": 1015
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
    "arms": [],
    "order": [
      "body",
      "head",
      "hand"
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
    "drawnAction": [
      "think"
    ],
    "mouthStyle": {
      "drawn": "neutral",
      "open": false
    }
  },
  "grandpa-cheer": {
    "dir": "fedtoon/cast/grandpa-cheer",
    "units": 312,
    "feetY": 1443,
    "top": 97,
    "centerX": 505,
    "parts": {
      "head": {
        "x": 266,
        "y": 96,
        "w": 484,
        "h": 413
      },
      "arm-r": {
        "x": 615,
        "y": 127,
        "w": 317,
        "h": 536
      },
      "arm-l": {
        "x": 92,
        "y": 124,
        "w": 315,
        "h": 545
      },
      "body": {
        "x": 241,
        "y": 386,
        "w": 527,
        "h": 1059
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
    "drawnAction": [
      "cheer"
    ],
    "mouthStyle": {
      "drawn": "happy",
      "open": true
    },
    "elbowRange": [
      -4,
      2
    ]
  }
};
