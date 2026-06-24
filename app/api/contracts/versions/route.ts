export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

const SOLC_VERSIONS = [
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
  { version:"0.8.13", label:"0.8.13"                            },
  { version:"0.8.11", label:"0.8.11"                            },
  { version:"0.8.9",  label:"0.8.9"                             },
  { version:"0.8.7",  label:"0.8.7"                             },
  { version:"0.8.4",  label:"0.8.4"                             },
  { version:"0.7.6",  label:"0.7.6"                             },
  { version:"0.7.5",  label:"0.7.5"                             },
  { version:"0.6.12", label:"0.6.12"                            },
  { version:"0.5.17", label:"0.5.17"                            },
];

export async function GET() {
  return NextResponse.json({ versions: SOLC_VERSIONS, default: "0.8.20" });
}
