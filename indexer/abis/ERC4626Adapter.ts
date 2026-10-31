// Generated from contracts/abi/ERC4626Adapter.json
export const ERC4626AdapterAbi = [
 {
  "type": "function",
  "name": "asset",
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
  "name": "cap",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "lastPriceUpdate",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "maxDeposit",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "maxStaleness",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "navFeed",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract IAggregatorV3"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "owner",
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
  "name": "pendingOwner",
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
  "name": "position",
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
  "name": "sharesOf",
  "inputs": [
   {
    "name": "holder",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [
   {
    "name": "vaultShares",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "totalShares",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "totalValue",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
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
    "internalType": "contract IERC20"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "valueOf",
  "inputs": [
   {
    "name": "holder",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "vault",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract IERC4626"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "event",
  "name": "CapSet",
  "inputs": [
   {
    "name": "cap",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "Deposited",
  "inputs": [
   {
    "name": "holder",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "assets",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "shares",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "FeedSet",
  "inputs": [
   {
    "name": "feed",
    "type": "address",
    "indexed": false,
    "internalType": "address"
   },
   {
    "name": "maxStaleness",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "OwnershipTransferStarted",
  "inputs": [
   {
    "name": "previousOwner",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "newOwner",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "OwnershipTransferred",
  "inputs": [
   {
    "name": "previousOwner",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "newOwner",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "Withdrawn",
  "inputs": [
   {
    "name": "holder",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "to",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "assets",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "shares",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 }
] as const;
