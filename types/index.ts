// ================================
// GlowIDE Core Type Definitions
// ================================

export interface User {
  id: string;
  email: string;
  wallet_address?: string;
  avatar_url?: string;
  username?: string;
  plan: "free" | "pro" | "enterprise";
  is_admin: boolean;
  created_at: string;
}

export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  language: string;
  framework?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  type: "web" | "dapp" | "contract" | "api" | "fullstack";
  description?: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface FileNode {
  id: string;
  project_id: string;
  parent_id?: string;
  name: string;
  path: string;
  type: "file" | "directory";
  content?: string;
  language?: string;
  size?: number;
  is_modified?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  project_id?: string;
  workspace_id?: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
  messages?: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokens_used?: number;
  created_at: string;
  metadata?: Record<string, unknown>;
  toolCall?: { id: string; name: string; args: Record<string, unknown> };
  toolResult?: { success: boolean; message: string; txId?: string };
}

export interface DeployedContract {
  id: string;
  user_id: string;
  project_id?: string;
  name: string;
  source_code: string;
  abi: ContractABI[];
  bytecode: string;
  address: string;
  chain_id: number;
  tx_hash: string;
  deployer: string;
  status: "pending" | "deployed" | "failed" | "verified";
  verified: boolean;
  block_number?: number;
  gas_used?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
  toolCall?: { id: string; name: string; args: Record<string, unknown> };
  toolResult?: { success: boolean; message: string; txId?: string };
}

export interface ContractABI {
  type: string;
  name?: string;
  inputs?: ABIInput[];
  outputs?: ABIOutput[];
  stateMutability?: string;
  anonymous?: boolean;
}

export interface ABIInput {
  name: string;
  type: string;
  internalType?: string;
  components?: ABIInput[];
}

export interface ABIOutput {
  name: string;
  type: string;
  internalType?: string;
  components?: ABIOutput[];
}

export interface WalletConnection {
  id: string;
  user_id: string;
  address: string;
  chain_id: number;
  type: "injected" | "walletconnect" | "coinbase";
  is_primary: boolean;
  connected_at: string;
}

export interface TokenBalance {
  symbol: string;
  name: string;
  address?: string;
  balance: string;
  decimals: number;
  usd_value?: number;
  logo?: string;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed?: string;
  status: "success" | "failed" | "pending";
  blockNumber?: number;
  timestamp?: number;
  input?: string;
  type?: string;
}

export interface BuildJob {
  id: string;
  user_id: string;
  project_id: string;
  type: "compile" | "test" | "build" | "deploy";
  status: "queued" | "running" | "success" | "failed";
  output?: string;
  error?: string;
  started_at?: string;
  finished_at?: string;
  created_at: string;
}

export interface SystemSetting {
  key: string;
  value: string;
  description?: string;
  is_public: boolean;
  updated_at: string;
}

export interface AdminKey {
  id: string;
  service: string;
  key_hash: string;
  label?: string;
  is_active: boolean;
  created_at: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  type: "web" | "dapp" | "contract" | "api" | "fullstack";
  language: string;
  framework?: string;
  thumbnail?: string;
  tags: string[];
  files: TemplateFile[];
  is_featured: boolean;
  downloads: number;
  created_at: string;
}

export interface TemplateFile {
  path: string;
  content: string;
  language: string;
}

export interface CompileResult {
  success: boolean;
  abi?: ContractABI[];
  bytecode?: string;
  errors?: CompileError[];
  warnings?: CompileError[];
  metadata?: Record<string, unknown>;
  toolCall?: { id: string; name: string; args: Record<string, unknown> };
  toolResult?: { success: boolean; message: string; txId?: string };
}

export interface CompileError {
  type: "error" | "warning";
  severity: number;
  message: string;
  formattedMessage?: string;
  sourceLocation?: {
    file: string;
    start: number;
    end: number;
  };
}

export interface ExplorerResult {
  type: "address" | "transaction" | "block" | "token" | "contract";
  data: Record<string, unknown>;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  context_length: number;
  pricing?: {
    prompt: number;
    completion: number;
  };
}

export interface OpenRouterSettings {
  api_key: string;
  default_model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  available_models: AIModel[];
  per_plan_limits: Record<string, number>;
}

export type Language =
  | "javascript"
  | "typescript"
  | "html"
  | "css"
  | "python"
  | "solidity"
  | "json"
  | "markdown"
  | "yaml"
  | "rust"
  | "go"
  | "shell"
  | "sql";

export interface EditorTab {
  id: string;
  fileId: string;
  name: string;
  path: string;
  language: Language;
  content: string;
  isModified: boolean;
  isActive: boolean;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "deployment" | "wallet" | "system" | "build" | "info";
  title: string;
  message: string;
  is_read: boolean;
  link?: string;
  created_at: string;
}
