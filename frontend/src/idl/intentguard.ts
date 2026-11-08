/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/intentguard.json`.
 */
export type Intentguard = {
  "address": "HUcVUeiiuJhTmzDzJDEgJ7tkejGmmKFTapaXvLVvkjcE",
  "metadata": {
    "name": "intentguard",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "IntentGuard: on-chain spending policy and human approval for AI agent payments"
  },
  "instructions": [
    {
      "name": "approveAndExecutePayment",
      "discriminator": [
        180,
        86,
        164,
        111,
        176,
        106,
        162,
        165
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "vault"
              }
            ]
          },
          "relations": [
            "proposal"
          ]
        },
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "recipient",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "expectedNonce",
          "type": "u64"
        }
      ]
    },
    {
      "name": "depositSol",
      "discriminator": [
        108,
        81,
        78,
        117,
        125,
        155,
        56,
        200
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "vault"
              }
            ]
          }
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
      "name": "initializeVault",
      "discriminator": [
        48,
        191,
        163,
        44,
        71,
        129,
        63,
        164
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "authorizedAgent",
          "type": "pubkey"
        },
        {
          "name": "approvedRecipient",
          "type": "pubkey"
        },
        {
          "name": "maxAmountLamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "proposePayment",
      "discriminator": [
        102,
        219,
        97,
        51,
        201,
        219,
        247,
        27
      ],
      "accounts": [
        {
          "name": "agent",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "vault"
              }
            ]
          }
        },
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
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
        },
        {
          "name": "recipient",
          "type": "pubkey"
        },
        {
          "name": "intentHash",
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
      "name": "rejectPayment",
      "discriminator": [
        199,
        215,
        82,
        136,
        197,
        236,
        68,
        26
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "vault"
              }
            ]
          },
          "relations": [
            "proposal"
          ]
        },
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "updatePolicy",
      "discriminator": [
        212,
        245,
        246,
        7,
        163,
        151,
        18,
        57
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "vault"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newAuthorizedAgent",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "newApprovedRecipient",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "newMaxAmount",
          "type": {
            "option": "u64"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "paymentProposal",
      "discriminator": [
        12,
        244,
        209,
        90,
        226,
        76,
        223,
        128
      ]
    },
    {
      "name": "vault",
      "discriminator": [
        211,
        8,
        232,
        43,
        2,
        152,
        117,
        119
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorizedAgent",
      "msg": "The signer is not authorized to propose payments for this vault."
    },
    {
      "code": 6001,
      "name": "unauthorizedOwner",
      "msg": "Only the registered vault owner can perform this operation."
    },
    {
      "code": 6002,
      "name": "amountExceedsPolicyLimit",
      "msg": "The proposed payment amount exceeds the maximum configured policy limit."
    },
    {
      "code": 6003,
      "name": "unapprovedRecipient",
      "msg": "The requested recipient does not match the approved recipient address."
    },
    {
      "code": 6004,
      "name": "proposalNotPending",
      "msg": "The payment proposal is not in a pending state."
    },
    {
      "code": 6005,
      "name": "insufficientVaultBalance",
      "msg": "The vault has insufficient liquid lamports to execute this payment."
    },
    {
      "code": 6006,
      "name": "invalidProposalVault",
      "msg": "Proposal does not belong to the specified vault."
    },
    {
      "code": 6007,
      "name": "invalidRecipientAccount",
      "msg": "The passed recipient account does not match the proposal recipient."
    },
    {
      "code": 6008,
      "name": "invalidAmount",
      "msg": "The amount must be greater than zero."
    },
    {
      "code": 6009,
      "name": "staleProposal",
      "msg": "The proposal changed since the owner reviewed it."
    },
    {
      "code": 6010,
      "name": "pendingProposalExists",
      "msg": "A pending proposal already exists; the owner must approve or reject it first."
    },
    {
      "code": 6011,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow."
    }
  ],
  "types": [
    {
      "name": "paymentProposal",
      "docs": [
        "The vault's single proposal slot, reused once the previous proposal is resolved.",
        "PDA seeds: [b\"proposal\", vault]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "intentHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "proposalStatus"
              }
            }
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "nonce",
            "docs": [
              "Starts at 1 and increases with every new proposal. The owner's approval",
              "names the nonce they reviewed, so it can never apply to a later proposal."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "proposalStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "executed"
          },
          {
            "name": "rejected"
          }
        ]
      }
    },
    {
      "name": "vault",
      "docs": [
        "Holds the owner's SOL and the spending policy.",
        "PDA seeds: [b\"vault\", owner]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "authorizedAgent",
            "type": "pubkey"
          },
          {
            "name": "approvedRecipient",
            "type": "pubkey"
          },
          {
            "name": "maxAmountLamports",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
