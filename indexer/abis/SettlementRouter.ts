// Generated from contracts/abi/SettlementRouter.json
export const SettlementRouterAbi = [
 {
  "type": "function",
  "name": "DEFAULT_ADMIN_ROLE",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "bytes32",
    "internalType": "bytes32"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "PAUSER_ROLE",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "bytes32",
    "internalType": "bytes32"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "buffer",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract IUnsleptBuffer"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "buffers",
  "inputs": [],
  "outputs": [
   {
    "name": "list",
    "type": "address[]",
    "internalType": "address[]"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "feeModule",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract IFeeModule"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "getRoleAdmin",
  "inputs": [
   {
    "name": "role",
    "type": "bytes32",
    "internalType": "bytes32"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "bytes32",
    "internalType": "bytes32"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "hasRole",
  "inputs": [
   {
    "name": "role",
    "type": "bytes32",
    "internalType": "bytes32"
   },
   {
    "name": "account",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "paused",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "registry",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract IAgentRegistry"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "stakerBuffer",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract IUnsleptBuffer"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "supportsInterface",
  "inputs": [
   {
    "name": "interfaceId",
    "type": "bytes4",
    "internalType": "bytes4"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "event",
  "name": "ConfigSet",
  "inputs": [
   {
    "name": "feeModule",
    "type": "address",
    "indexed": false,
    "internalType": "address"
   },
   {
    "name": "buffer",
    "type": "address",
    "indexed": false,
    "internalType": "address"
   },
   {
    "name": "stakerBuffer",
    "type": "address",
    "indexed": false,
    "internalType": "address"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "Paused",
  "inputs": [
   {
    "name": "account",
    "type": "address",
    "indexed": false,
    "internalType": "address"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "RoleAdminChanged",
  "inputs": [
   {
    "name": "role",
    "type": "bytes32",
    "indexed": true,
    "internalType": "bytes32"
   },
   {
    "name": "previousAdminRole",
    "type": "bytes32",
    "indexed": true,
    "internalType": "bytes32"
   },
   {
    "name": "newAdminRole",
    "type": "bytes32",
    "indexed": true,
    "internalType": "bytes32"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "RoleGranted",
  "inputs": [
   {
    "name": "role",
    "type": "bytes32",
    "indexed": true,
    "internalType": "bytes32"
   },
   {
    "name": "account",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "sender",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "RoleRevoked",
  "inputs": [
   {
    "name": "role",
    "type": "bytes32",
    "indexed": true,
    "internalType": "bytes32"
   },
   {
    "name": "account",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "sender",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "Settled",
  "inputs": [
   {
    "name": "paymentId",
    "type": "bytes32",
    "indexed": true,
    "internalType": "bytes32"
   },
   {
    "name": "agent",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "payee",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "buffer",
    "type": "address",
    "indexed": false,
    "internalType": "address"
   },
   {
    "name": "recipient",
    "type": "address",
    "indexed": false,
    "internalType": "address"
   },
   {
    "name": "amount",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "fee",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "mode",
    "type": "uint8",
    "indexed": false,
    "internalType": "enum ISettlementRouter.Mode"
   },
   {
    "name": "endpoint",
    "type": "string",
    "indexed": false,
    "internalType": "string"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "Unpaused",
  "inputs": [
   {
    "name": "account",
    "type": "address",
    "indexed": false,
    "internalType": "address"
   }
  ],
  "anonymous": false
 }
] as const;
