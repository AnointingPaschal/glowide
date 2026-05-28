// ================================
// Solidity Compiler Integration
// ================================

export interface CompileInput {
  sourceCode: string;
  contractName?: string;
  compilerVersion?: string;
  optimizer?: {
    enabled: boolean;
    runs: number;
  };
}

export interface CompileOutput {
  success: boolean;
  abi?: unknown[];
  bytecode?: string;
  deployedBytecode?: string;
  errors?: Array<{
    type: "error" | "warning";
    message: string;
    formattedMessage?: string;
    severity?: string;
  }>;
  contractName?: string;
  metadata?: string;
}

export async function compileContract(input: CompileInput): Promise<CompileOutput> {
  const response = await fetch("/api/contracts/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    return {
      success: false,
      errors: [{ type: "error", message: error.message || "Compilation failed" }],
    };
  }

  return response.json();
}

export async function estimateDeployGas(
  abi: unknown[],
  bytecode: string,
  constructorArgs: unknown[],
  deployerAddress: string
): Promise<string> {
  const response = await fetch("/api/contracts/estimate-gas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ abi, bytecode, constructorArgs, deployerAddress }),
  });

  if (!response.ok) return "0";
  const data = await response.json();
  return data.gasEstimate || "0";
}

export function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    sol: "solidity",
    html: "html",
    css: "css",
    scss: "scss",
    json: "json",
    md: "markdown",
    yaml: "yaml",
    yml: "yaml",
    rs: "rust",
    go: "go",
    sh: "shell",
    bash: "shell",
    sql: "sql",
    toml: "toml",
    env: "plaintext",
  };
  return map[ext || ""] || "plaintext";
}

export function getFileIcon(filename: string, isDirectory?: boolean): string {
  if (isDirectory) return "📁";
  const ext = filename.split(".").pop()?.toLowerCase();
  const icons: Record<string, string> = {
    ts: "🔵",
    tsx: "⚛️",
    js: "🟡",
    jsx: "⚛️",
    py: "🐍",
    sol: "💎",
    html: "🌐",
    css: "🎨",
    json: "📋",
    md: "📝",
    yaml: "⚙️",
    yml: "⚙️",
    rs: "🦀",
    go: "🐹",
    sh: "💻",
    sql: "🗃️",
    env: "🔒",
  };
  return icons[ext || ""] || "📄";
}

// Boilerplate contract templates
export const CONTRACT_TEMPLATES = {
  erc20: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address initialOwner
    ) ERC20(name, symbol) Ownable(initialOwner) {
        _mint(initialOwner, initialSupply * 10 ** decimals());
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}`,

  erc721: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract MyNFT is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    
    string private _baseTokenURI;
    uint256 public maxSupply;
    uint256 public mintPrice;

    constructor(
        string memory name,
        string memory symbol,
        string memory baseURI,
        uint256 _maxSupply,
        uint256 _mintPrice,
        address initialOwner
    ) ERC721(name, symbol) Ownable(initialOwner) {
        _baseTokenURI = baseURI;
        maxSupply = _maxSupply;
        mintPrice = _mintPrice;
    }

    function mint(address to) external payable returns (uint256) {
        require(msg.value >= mintPrice, "Insufficient payment");
        require(_tokenIds.current() < maxSupply, "Max supply reached");
        
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        _safeMint(to, newTokenId);
        return newTokenId;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}`,

  simple: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SimpleStorage
 * @dev Store and retrieve a value
 */
contract SimpleStorage {
    uint256 private storedValue;
    address public owner;
    
    event ValueChanged(uint256 indexed oldValue, uint256 indexed newValue, address indexed changedBy);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function set(uint256 value) external onlyOwner {
        uint256 oldValue = storedValue;
        storedValue = value;
        emit ValueChanged(oldValue, value, msg.sender);
    }

    function get() external view returns (uint256) {
        return storedValue;
    }
}`,
};
