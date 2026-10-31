// Generated from contracts/abi/AgentAccountFactory.json
export const AgentAccountFactoryAbi = [
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
  "name": "accountsOf",
  "inputs": [
   {
    "name": "owner",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "address[]",
    "internalType": "address[]"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "allocator",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "address"
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
    "name": "",
    "type": "address[]",
    "internalType": "address[]"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "entryPoint",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "address"
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
  "name": "implementation",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "address"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "isAccount",
  "inputs": [
   {
    "name": "",
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
  "name": "predictAddress",
  "inputs": [
   {
    "name": "owner",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "salt",
    "type": "bytes32",
    "internalType": "bytes32"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "address"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "router",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "address"
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
  "type": "function",
  "name": "usdg",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "address"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "event",
  "name": "AccountCreated",
  "inputs": [
   {
    "name": "account",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "owner",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "signer",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "treasury",
    "type": "bool",
    "indexed": false,
    "internalType": "bool"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "ConfigSet",
  "inputs": [
   {
    "name": "router",
    "type": "address",
    "indexed": false,
    "internalType": "address"
   },
   {
    "name": "allocator",
    "type": "address",
    "indexed": false,
    "internalType": "address"
   },
   {
    "name": "entryPoint",
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
 }
] as const;
