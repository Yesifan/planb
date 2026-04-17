// If you need to load environment variables outside of the Next.js runtime
// such as in a root config file for an ORM or test runner, you can use the @next/env package.
import { loadEnvConfig } from "@next/env";

const projectDir = process.cwd();
loadEnvConfig(projectDir);
