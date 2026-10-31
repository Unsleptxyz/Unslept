/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/unslept.json`.
 */
export type Unslept = {
  "address": "HbAgL4w8R9D8RUEuK4rJknK5Vn8rBusfRtfTnFcYieue",
  "metadata": {
    "name": "unslept",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Unslept: yield-aware x402 payment accounts for AI agents on Solana"
  },
  "instructions": [
    {
      "name": "acceptAdmin",
      "discriminator": [
        112,
        42,
        45,
        90,
        116,
        181,
        13,
        170
      ],
      "accounts": [
        {
          "name": "newAdmin",
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "agentWithdraw",
      "discriminator": [
        13,
        149,
        99,
        245,
        171,
        171,
        185,
        53
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "agent"
          ]
        },
        {
          "name": "agent",
          "writable": true
        },
        {
          "name": "agentVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "destination",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "applyParams",
      "discriminator": [
        188,
        203,
        86,
        124,
        178,
        34,
        133,
        116
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "bufferDeposit",
      "discriminator": [
        116,
        43,
        213,
        36,
        140,
        232,
        79,
        207
      ],
      "accounts": [
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "bufferVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "shareMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  97,
                  114,
                  101,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "depositorUsdc",
          "writable": true
        },
        {
          "name": "depositorShares",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "assets",
          "type": "u64"
        }
      ]
    },
    {
      "name": "bufferWithdraw",
      "discriminator": [
        150,
        119,
        201,
        186,
        120,
        192,
        208,
        175
      ],
      "accounts": [
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "bufferVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "shareMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  97,
                  114,
                  101,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "depositorUsdc",
          "writable": true
        },
        {
          "name": "depositorShares",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "shares",
          "type": "u64"
        }
      ]
    },
    {
      "name": "cancelParams",
      "discriminator": [
        100,
        172,
        113,
        60,
        25,
        68,
        80,
        172
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "closePayment",
      "discriminator": [
        172,
        106,
        77,
        250,
        247,
        169,
        156,
        178
      ],
      "accounts": [
        {
          "name": "rentPayer",
          "writable": true
        },
        {
          "name": "payment",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "createAgent",
      "discriminator": [
        143,
        66,
        198,
        95,
        110,
        85,
        83,
        249
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "agent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "arg",
                "path": "agentId"
              }
            ]
          }
        },
        {
          "name": "agentVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "agentId",
          "type": "u64"
        },
        {
          "name": "signer",
          "type": "pubkey"
        },
        {
          "name": "perCallCap",
          "type": "u64"
        },
        {
          "name": "dailyCap",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "bufferVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "shareMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  97,
                  114,
                  101,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "params"
            }
          }
        }
      ]
    },
    {
      "name": "pay",
      "discriminator": [
        119,
        18,
        216,
        65,
        192,
        117,
        122,
        220
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "agent",
          "writable": true
        },
        {
          "name": "agentVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "bufferVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "payeeToken",
          "writable": true
        },
        {
          "name": "payment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "paymentId"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "paymentId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "endpointHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "proposeAdmin",
      "discriminator": [
        121,
        214,
        199,
        212,
        87,
        39,
        117,
        234
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newAdmin",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "proposeParams",
      "discriminator": [
        94,
        141,
        220,
        182,
        171,
        53,
        52,
        182
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "params"
            }
          }
        }
      ]
    },
    {
      "name": "repayDebt",
      "discriminator": [
        79,
        200,
        30,
        15,
        252,
        22,
        162,
        8
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "agent",
          "writable": true
        },
        {
          "name": "agentVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "bufferVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "revoke",
      "discriminator": [
        170,
        23,
        31,
        34,
        133,
        173,
        93,
        242
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "agent"
          ]
        },
        {
          "name": "agent",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "setAgentPaused",
      "discriminator": [
        156,
        197,
        182,
        170,
        124,
        76,
        118,
        195
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "agent"
          ]
        },
        {
          "name": "agent",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "paused",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setAllowlist",
      "discriminator": [
        141,
        30,
        41,
        131,
        132,
        7,
        216,
        134
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "agent"
          ]
        },
        {
          "name": "agent",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "payees",
          "type": {
            "vec": "pubkey"
          }
        }
      ]
    },
    {
      "name": "setPaused",
      "discriminator": [
        91,
        60,
        125,
        192,
        176,
        225,
        166,
        218
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "paused",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setPolicy",
      "discriminator": [
        40,
        133,
        12,
        157,
        235,
        202,
        2,
        132
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "agent"
          ]
        },
        {
          "name": "agent",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "perCallCap",
          "type": "u64"
        },
        {
          "name": "dailyCap",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setSigner",
      "discriminator": [
        127,
        120,
        252,
        184,
        97,
        4,
        88,
        68
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "agent"
          ]
        },
        {
          "name": "agent",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "signer",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "setYieldReserve",
      "discriminator": [
        148,
        31,
        146,
        96,
        162,
        155,
        193,
        169
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "reserve",
          "type": "pubkey"
        },
        {
          "name": "ctokenMint",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "yieldDeposit",
      "discriminator": [
        197,
        128,
        119,
        222,
        188,
        102,
        165,
        63
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "agent"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "agent",
          "writable": true
        },
        {
          "name": "agentVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "agentCtoken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116,
                  95,
                  99,
                  116,
                  111,
                  107,
                  101,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "ctokenMint",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "reserve",
          "writable": true
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "lendingMarketAuthority"
        },
        {
          "name": "reserveLiquiditySupply",
          "writable": true
        },
        {
          "name": "instructionSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "klendProgram",
          "address": "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "yieldRedeem",
      "discriminator": [
        229,
        64,
        30,
        80,
        246,
        159,
        124,
        214
      ],
      "accounts": [
        {
          "name": "caller",
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "agent",
          "writable": true
        },
        {
          "name": "agentVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "agentCtoken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116,
                  95,
                  99,
                  116,
                  111,
                  107,
                  101,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "bufferVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "ctokenMint",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "reserve",
          "writable": true
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "lendingMarketAuthority"
        },
        {
          "name": "reserveLiquiditySupply",
          "writable": true
        },
        {
          "name": "instructionSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "klendProgram",
          "address": "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "ctokens",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "agent",
      "discriminator": [
        47,
        166,
        112,
        147,
        155,
        197,
        86,
        7
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "payment",
      "discriminator": [
        227,
        231,
        51,
        26,
        244,
        88,
        4,
        148
      ]
    }
  ],
  "events": [
    {
      "name": "agentCreated",
      "discriminator": [
        237,
        44,
        61,
        111,
        90,
        251,
        241,
        34
      ]
    },
    {
      "name": "bufferDeposited",
      "discriminator": [
        245,
        11,
        66,
        251,
        235,
        96,
        90,
        2
      ]
    },
    {
      "name": "bufferWithdrawn",
      "discriminator": [
        75,
        118,
        177,
        214,
        183,
        17,
        158,
        228
      ]
    },
    {
      "name": "debtRepaid",
      "discriminator": [
        145,
        11,
        56,
        225,
        154,
        212,
        54,
        105
      ]
    },
    {
      "name": "paramsApplied",
      "discriminator": [
        79,
        221,
        60,
        141,
        244,
        69,
        47,
        209
      ]
    },
    {
      "name": "paramsProposed",
      "discriminator": [
        29,
        64,
        243,
        241,
        75,
        135,
        93,
        142
      ]
    },
    {
      "name": "settled",
      "discriminator": [
        232,
        210,
        40,
        17,
        142,
        124,
        145,
        238
      ]
    },
    {
      "name": "yieldDeposited",
      "discriminator": [
        240,
        44,
        237,
        73,
        80,
        47,
        196,
        86
      ]
    },
    {
      "name": "yieldRedeemed",
      "discriminator": [
        146,
        205,
        76,
        218,
        82,
        193,
        102,
        135
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "protocolPaused",
      "msg": "The protocol is paused."
    },
    {
      "code": 6001,
      "name": "notAdmin",
      "msg": "Only the admin can do this."
    },
    {
      "code": 6002,
      "name": "notPauser",
      "msg": "Only the pauser or admin can do this."
    },
    {
      "code": 6003,
      "name": "notOwner",
      "msg": "Only the agent owner can do this."
    },
    {
      "code": 6004,
      "name": "notSigner",
      "msg": "Only the agent signer can request payments."
    },
    {
      "code": 6005,
      "name": "feeTooHigh",
      "msg": "Fee above the 1% maximum."
    },
    {
      "code": 6006,
      "name": "notReady",
      "msg": "No parameter change is pending, or its delay has not passed."
    },
    {
      "code": 6007,
      "name": "zeroAmount",
      "msg": "Amount must be greater than zero."
    },
    {
      "code": 6008,
      "name": "capExceeded",
      "msg": "Deposit would exceed the buffer cap."
    },
    {
      "code": 6009,
      "name": "insufficientLiquidity",
      "msg": "The buffer does not hold enough liquid USDC right now."
    },
    {
      "code": 6010,
      "name": "agentPaused",
      "msg": "The agent is paused by its owner."
    },
    {
      "code": 6011,
      "name": "agentRevoked",
      "msg": "The agent was revoked by its owner."
    },
    {
      "code": 6012,
      "name": "perCallCapExceeded",
      "msg": "Payment above the per-call cap."
    },
    {
      "code": 6013,
      "name": "dailyCapExceeded",
      "msg": "Payment would exceed the daily cap."
    },
    {
      "code": 6014,
      "name": "payeeNotAllowed",
      "msg": "The payee is not on the agent's allowlist."
    },
    {
      "code": 6015,
      "name": "insufficientCollateral",
      "msg": "The agent cannot cover this payment: not enough USDC and yield position."
    },
    {
      "code": 6016,
      "name": "allowlistTooLong",
      "msg": "Allowlist holds at most 8 payees."
    },
    {
      "code": 6017,
      "name": "wouldLeaveDebtUncovered",
      "msg": "Withdrawal would leave the agent's debt uncovered."
    },
    {
      "code": 6018,
      "name": "recordTooYoung",
      "msg": "Payment records can be closed 24 hours after settlement."
    },
    {
      "code": 6019,
      "name": "wrongMint",
      "msg": "Token account mint does not match USDC."
    },
    {
      "code": 6020,
      "name": "overflow",
      "msg": "Arithmetic overflow."
    },
    {
      "code": 6021,
      "name": "yieldReserveAlreadySet",
      "msg": "The yield reserve is already set."
    },
    {
      "code": 6022,
      "name": "yieldReserveNotSet",
      "msg": "No yield reserve is configured."
    },
    {
      "code": 6023,
      "name": "notOwnerOrKeeper",
      "msg": "Only the owner or the keeper can do this."
    },
    {
      "code": 6024,
      "name": "insufficientPosition",
      "msg": "Not enough yield position."
    }
  ],
  "types": [
    {
      "name": "agent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "signer",
            "type": "pubkey"
          },
          {
            "name": "agentId",
            "type": "u64"
          },
          {
            "name": "perCallCap",
            "type": "u64"
          },
          {
            "name": "dailyCap",
            "type": "u64"
          },
          {
            "name": "spentToday",
            "type": "u64"
          },
          {
            "name": "spendDay",
            "type": "i64"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "revoked",
            "type": "bool"
          },
          {
            "name": "debt",
            "docs": [
              "USDC owed to the buffer."
            ],
            "type": "u64"
          },
          {
            "name": "positionValue",
            "docs": [
              "Value of the agent's yield position, in USDC, as last refreshed by the yield adapter. Backs debt."
            ],
            "type": "u64"
          },
          {
            "name": "payments",
            "type": "u64"
          },
          {
            "name": "allowlistLen",
            "type": "u8"
          },
          {
            "name": "allowlist",
            "type": {
              "array": [
                "pubkey",
                8
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "agentCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "signer",
            "type": "pubkey"
          },
          {
            "name": "agentId",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "bufferDeposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "depositor",
            "type": "pubkey"
          },
          {
            "name": "assets",
            "type": "u64"
          },
          {
            "name": "shares",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "bufferWithdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "depositor",
            "type": "pubkey"
          },
          {
            "name": "assets",
            "type": "u64"
          },
          {
            "name": "shares",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "pendingAdmin",
            "type": "pubkey"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          },
          {
            "name": "params",
            "type": {
              "defined": {
                "name": "params"
              }
            }
          },
          {
            "name": "pendingParams",
            "type": {
              "defined": {
                "name": "params"
              }
            }
          },
          {
            "name": "pendingEta",
            "docs": [
              "Unix time after which pending_params can be applied. 0 when nothing is pending."
            ],
            "type": "i64"
          },
          {
            "name": "outstandingDebt",
            "docs": [
              "USDC the buffer has fronted and not yet been repaid."
            ],
            "type": "u64"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          },
          {
            "name": "shareMintBump",
            "type": "u8"
          },
          {
            "name": "yieldReserve",
            "docs": [
              "Kamino reserve that holds agent yield positions. Set once by the admin."
            ],
            "type": "pubkey"
          },
          {
            "name": "yieldCtokenMint",
            "docs": [
              "Collateral (cToken) mint of that reserve."
            ],
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "debtRepaid",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "remaining",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "params",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "depositCap",
            "type": "u64"
          },
          {
            "name": "pauser",
            "type": "pubkey"
          },
          {
            "name": "keeper",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "paramsApplied",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "params",
            "type": {
              "defined": {
                "name": "params"
              }
            }
          }
        ]
      }
    },
    {
      "name": "paramsProposed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "params",
            "type": {
              "defined": {
                "name": "params"
              }
            }
          },
          {
            "name": "eta",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "payment",
      "docs": [
        "One per settled payment. Proves to the merchant that payment_id was paid, and blocks reuse."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "paymentId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "payee",
            "docs": [
              "Owner of the token account that received the USDC."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          },
          {
            "name": "endpointHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          },
          {
            "name": "rentPayer",
            "docs": [
              "Who paid the rent; gets it back when the record is closed."
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "settled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "paymentId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "payee",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          },
          {
            "name": "fronted",
            "type": "u64"
          },
          {
            "name": "endpointHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "yieldDeposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "ctokens",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "yieldRedeemed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "ctokens",
            "type": "u64"
          },
          {
            "name": "received",
            "type": "u64"
          },
          {
            "name": "repaid",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
