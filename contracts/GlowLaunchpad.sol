// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ── Uniswap V2 interfaces (Arc DEX clone) ────────────────────────────────
interface IUniswapV2Router02 {
    function factory() external pure returns (address);
    function addLiquidityETH(
        address token, uint amountTokenDesired, uint amountTokenMin,
        uint amountETHMin, address to, uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);
    function WETH() external pure returns (address);
}
interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}
interface IERC20Minimal {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
}

// ── LaunchedToken — ERC20 with tokenURI & on-chain metadata ──────────────
contract LaunchedToken is ERC20, Ownable {
    string  private _tokenURI;
    string  public  description;
    string  public  website;
    string  public  twitter;
    uint8   private _decimals;

    constructor(
        string memory name_, string memory symbol_, uint8 decimals_,
        uint256 totalSupply_, address recipient_,
        string memory tokenURI_, string memory description_,
        string memory website_, string memory twitter_,
        address initialOwner_
    ) ERC20(name_, symbol_) Ownable(initialOwner_) {
        _decimals      = decimals_;
        _tokenURI      = tokenURI_;
        description    = description_;
        website        = website_;
        twitter        = twitter_;
        _mint(recipient_, totalSupply_);
    }

    function decimals() public view override returns (uint8) { return _decimals; }
    function tokenURI() external view returns (string memory) { return _tokenURI; }
    function setTokenURI(string calldata uri) external onlyOwner { _tokenURI = uri; }
}

// ── GlowLaunchpad Factory ─────────────────────────────────────────────────
/**
 * @title GlowLaunchpad
 * @notice One-click token deploy + Uniswap V2 LP with time-locked LP tokens.
 * @dev Arc Testnet — USDC is native gas (6 dec). evmVersion: paris.
 *      launchAndPool(): deploys ERC20, adds initial liquidity, locks LP tokens.
 *      withdrawLiquidity(): creator claims LP tokens after lockDurationDays.
 */
contract GlowLaunchpad is ReentrancyGuard {

    // ── Structs ──────────────────────────────────────────────────────────
    struct TokenParams {
        string  name;
        string  symbol;
        uint8   decimals;
        uint256 totalSupply;      // in wei (with decimals)
        uint256 liquidityPercent; // 0-100 — % of supply going to LP
        uint256 lockDurationDays; // LP lock duration in days
        string  tokenURI;         // IPFS metadata URI
        string  description;
        string  website;
        string  twitter;
    }

    struct TokenRecord {
        address tokenAddress;
        address creator;
        address pairAddress;
        uint256 lpAmount;
        uint256 lpUnlockTime;
        uint256 launchedAt;
        bool    liquidityWithdrawn;
        string  name;
        string  symbol;
        string  tokenURI;
    }

    // ── State ──────────────────────────────────────────────────────────
    address public immutable admin;
    address public dexRouter;              // Uniswap V2 compatible router on Arc
    uint256 public launchFee;              // USDC (native) fee to launch
    address public feeRecipient;
    uint256 public tokenCount;

    // token address → record
    mapping(address => TokenRecord) public tokens;
    // LP lock: creator => pairAddress => LP amount
    mapping(address => mapping(address => uint256)) public lockedLP;
    // index: n → token address (for discovery — NEVER delete)
    mapping(uint256 => address) public tokenIndex;

    // ── Events ─────────────────────────────────────────────────────────
    event TokenLaunched(
        address indexed token, address indexed creator, address indexed pair,
        string name, string symbol, string tokenURI,
        uint256 totalSupply, uint256 lpAmount, uint256 lockUntil
    );
    event LiquidityWithdrawn(address indexed token, address indexed creator, uint256 amount);
    event RouterUpdated(address newRouter);
    event FeeUpdated(uint256 newFee, address newRecipient);

    // ── Errors ─────────────────────────────────────────────────────────
    error NotAdmin();
    error LockNotExpired(uint256 unlockTime);
    error NoLockedLP();
    error TransferFailed();
    error InvalidPercent();
    error InsufficientFee(uint256 required, uint256 provided);

    modifier onlyAdmin() { if (msg.sender != admin) revert NotAdmin(); _; }

    constructor(address admin_, address dexRouter_, uint256 launchFee_, address feeRecipient_) {
        admin         = admin_;
        dexRouter     = dexRouter_;
        launchFee     = launchFee_;
        feeRecipient  = feeRecipient_;
    }

    // ── Core: launch + pool ───────────────────────────────────────────
    /**
     * @notice Deploy a new ERC-20 token and add initial Uniswap V2 liquidity.
     * @dev LP tokens are held by this contract until lockDurationDays expires.
     *      Caller must send launchFee (USDC) as msg.value.
     *      Additional msg.value above launchFee is used as native liquidity.
     */
    function launchAndPool(TokenParams calldata p)
        external payable nonReentrant returns (address tokenAddress, address pairAddress)
    {
        if (p.liquidityPercent > 100) revert InvalidPercent();
        if (launchFee > 0 && msg.value < launchFee) revert InsufficientFee(launchFee, msg.value);

        // Collect launch fee
        if (launchFee > 0 && feeRecipient != address(0)) {
            (bool ok,) = feeRecipient.call{value: launchFee}("");
            if (!ok) revert TransferFailed();
        }

        // Deploy token — factory is owner initially so we can transfer tokens to LP
        LaunchedToken token = new LaunchedToken(
            p.name, p.symbol, p.decimals, p.totalSupply, address(this),
            p.tokenURI, p.description, p.website, p.twitter, msg.sender
        );
        tokenAddress = address(token);

        // Calculate LP token amount
        uint256 lpTokens = (p.totalSupply * p.liquidityPercent) / 100;
        uint256 remaining = p.totalSupply - lpTokens;

        // Transfer non-LP tokens to creator
        token.transfer(msg.sender, remaining);

        // Add liquidity (if LP % > 0)
        uint256 lpAmount = 0;
        if (lpTokens > 0 && dexRouter != address(0)) {
            uint256 ethForLP = msg.value - launchFee;
            token.approve(dexRouter, lpTokens);

            IUniswapV2Router02 router = IUniswapV2Router02(dexRouter);
            try router.addLiquidityETH{value: ethForLP}(
                tokenAddress, lpTokens, 0, 0, address(this), block.timestamp + 300
            ) returns (uint256, uint256, uint256 liquidity) {
                lpAmount = liquidity;
            } catch {
                // If LP fails, return tokens to creator
                token.transfer(msg.sender, lpTokens);
            }

            address factory = router.factory();
            pairAddress = IUniswapV2Factory(factory).getPair(tokenAddress, router.WETH());
        }

        // Lock LP tokens
        uint256 unlockTime = block.timestamp + (p.lockDurationDays * 1 days);
        if (lpAmount > 0 && pairAddress != address(0)) {
            lockedLP[msg.sender][pairAddress] += lpAmount;
        }

        // Record
        tokens[tokenAddress] = TokenRecord({
            tokenAddress:        tokenAddress,
            creator:             msg.sender,
            pairAddress:         pairAddress,
            lpAmount:            lpAmount,
            lpUnlockTime:        unlockTime,
            launchedAt:          block.timestamp,
            liquidityWithdrawn:  false,
            name:                p.name,
            symbol:              p.symbol,
            tokenURI:            p.tokenURI,
        });
        tokenIndex[tokenCount++] = tokenAddress;

        emit TokenLaunched(tokenAddress, msg.sender, pairAddress, p.name, p.symbol, p.tokenURI, p.totalSupply, lpAmount, unlockTime);
    }

    // ── Withdraw locked LP ─────────────────────────────────────────────
    function withdrawLiquidity(address tokenAddress) external nonReentrant {
        TokenRecord storage record = tokens[tokenAddress];
        require(record.creator == msg.sender, "Not creator");
        if (record.liquidityWithdrawn) revert NoLockedLP();
        if (block.timestamp < record.lpUnlockTime) revert LockNotExpired(record.lpUnlockTime);

        uint256 amount = lockedLP[msg.sender][record.pairAddress];
        if (amount == 0) revert NoLockedLP();

        lockedLP[msg.sender][record.pairAddress] = 0;
        record.liquidityWithdrawn = true;

        IERC20Minimal(record.pairAddress).transfer(msg.sender, amount);
        emit LiquidityWithdrawn(tokenAddress, msg.sender, amount);
    }

    // ── Admin ──────────────────────────────────────────────────────────
    function setRouter(address router_)        external onlyAdmin { dexRouter = router_; emit RouterUpdated(router_); }
    function setFee(uint256 fee_, address recipient_) external onlyAdmin { launchFee = fee_; feeRecipient = recipient_; emit FeeUpdated(fee_, recipient_); }

    // ── Views ──────────────────────────────────────────────────────────
    function getToken(address addr) external view returns (TokenRecord memory) { return tokens[addr]; }
    function getLockStatus(address creator, address pair) external view returns (uint256 amount, uint256 unlockTime, bool unlocked) {
        TokenRecord storage r = tokens[pair];
        return (lockedLP[creator][pair], r.lpUnlockTime, r.liquidityWithdrawn);
    }
    function getAllTokens(uint256 offset, uint256 limit) external view
        returns (TokenRecord[] memory records, uint256 total)
    {
        total = tokenCount;
        uint256 end = offset + limit > total ? total : offset + limit;
        records = new TokenRecord[](end > offset ? end - offset : 0);
        for (uint256 i = offset; i < end; i++) {
            records[i - offset] = tokens[tokenIndex[i]];
        }
    }

    receive() external payable {}
}
