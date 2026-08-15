//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  { ignores: ['.output/**', 'src/generated/prisma/**'] },
  ...tanstackConfig,
]
