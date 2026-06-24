export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

// All major solc versions available on ethereum/solc-bin (Remix has these too)
const SOLC_VERSIONS = [
  // 0.8.x — full list
  { version:"0.8.30", label:"0.8.30",             tag:"latest"  },
  { version:"0.8.29", label:"0.8.29"                            },
  { version:"0.8.28", label:"0.8.28"                            },
  { version:"0.8.27", label:"0.8.27"                            },
  { version:"0.8.26", label:"0.8.26"                            },
  { version:"0.8.25", label:"0.8.25"                            },
  { version:"0.8.24", label:"0.8.24"                            },
  { version:"0.8.23", label:"0.8.23"                            },
  { version:"0.8.22", label:"0.8.22"                            },
  { version:"0.8.21", label:"0.8.21"                            },
  { version:"0.8.20", label:"0.8.20",             tag:"default" },
  { version:"0.8.19", label:"0.8.19"                            },
  { version:"0.8.18", label:"0.8.18"                            },
  { version:"0.8.17", label:"0.8.17"                            },
  { version:"0.8.16", label:"0.8.16"                            },
  { version:"0.8.15", label:"0.8.15"                            },
  { version:"0.8.14", label:"0.8.14"                            },
  { version:"0.8.13", label:"0.8.13"                            },
  { version:"0.8.12", label:"0.8.12"                            },
  { version:"0.8.11", label:"0.8.11"                            },
  { version:"0.8.10", label:"0.8.10"                            },
  { version:"0.8.9",  label:"0.8.9"                             },
  { version:"0.8.8",  label:"0.8.8"                             },
  { version:"0.8.7",  label:"0.8.7"                             },
  { version:"0.8.6",  label:"0.8.6"                             },
  { version:"0.8.5",  label:"0.8.5"                             },
  { version:"0.8.4",  label:"0.8.4"                             },
  { version:"0.8.3",  label:"0.8.3"                             },
  { version:"0.8.2",  label:"0.8.2"                             },
  { version:"0.8.1",  label:"0.8.1"                             },
  { version:"0.8.0",  label:"0.8.0"                             },
  // 0.7.x
  { version:"0.7.6",  label:"0.7.6"                             },
  { version:"0.7.5",  label:"0.7.5"                             },
  { version:"0.7.4",  label:"0.7.4"                             },
  { version:"0.7.3",  label:"0.7.3"                             },
  { version:"0.7.2",  label:"0.7.2"                             },
  { version:"0.7.1",  label:"0.7.1"                             },
  { version:"0.7.0",  label:"0.7.0"                             },
  // 0.6.x
  { version:"0.6.12", label:"0.6.12"                            },
  { version:"0.6.11", label:"0.6.11"                            },
  { version:"0.6.10", label:"0.6.10"                            },
  { version:"0.6.9",  label:"0.6.9"                             },
  { version:"0.6.8",  label:"0.6.8"                             },
  { version:"0.6.7",  label:"0.6.7"                             },
  { version:"0.6.6",  label:"0.6.6"                             },
  { version:"0.6.5",  label:"0.6.5"                             },
  { version:"0.6.4",  label:"0.6.4"                             },
  { version:"0.6.3",  label:"0.6.3"                             },
  { version:"0.6.2",  label:"0.6.2"                             },
  { version:"0.6.1",  label:"0.6.1"                             },
  { version:"0.6.0",  label:"0.6.0"                             },
  // 0.5.x
  { version:"0.5.17", label:"0.5.17"                            },
  { version:"0.5.16", label:"0.5.16"                            },
  { version:"0.5.15", label:"0.5.15"                            },
  { version:"0.5.14", label:"0.5.14"                            },
  { version:"0.5.13", label:"0.5.13"                            },
  { version:"0.5.12", label:"0.5.12"                            },
  { version:"0.5.11", label:"0.5.11"                            },
  { version:"0.5.10", label:"0.5.10"                            },
  { version:"0.5.9",  label:"0.5.9"                             },
  { version:"0.5.8",  label:"0.5.8"                             },
  { version:"0.5.7",  label:"0.5.7"                             },
  { version:"0.5.6",  label:"0.5.6"                             },
  { version:"0.5.5",  label:"0.5.5"                             },
  { version:"0.5.4",  label:"0.5.4"                             },
  { version:"0.5.3",  label:"0.5.3"                             },
  { version:"0.5.2",  label:"0.5.2"                             },
  { version:"0.5.1",  label:"0.5.1"                             },
  { version:"0.5.0",  label:"0.5.0"                             },
  // 0.4.x
  { version:"0.4.26", label:"0.4.26"                            },
  { version:"0.4.25", label:"0.4.25"                            },
  { version:"0.4.24", label:"0.4.24"                            },
  { version:"0.4.23", label:"0.4.23"                            },
  { version:"0.4.22", label:"0.4.22"                            },
  { version:"0.4.21", label:"0.4.21"                            },
];

// Group by minor version for display
const GROUPS = [
  { label:"0.8.x", versions: SOLC_VERSIONS.filter(v => v.version.startsWith("0.8")) },
  { label:"0.7.x", versions: SOLC_VERSIONS.filter(v => v.version.startsWith("0.7")) },
  { label:"0.6.x", versions: SOLC_VERSIONS.filter(v => v.version.startsWith("0.6")) },
  { label:"0.5.x", versions: SOLC_VERSIONS.filter(v => v.version.startsWith("0.5")) },
  { label:"0.4.x", versions: SOLC_VERSIONS.filter(v => v.version.startsWith("0.4")) },
];

export async function GET() {
  return NextResponse.json({ versions: SOLC_VERSIONS, groups: GROUPS, default: "0.8.20" });
}
