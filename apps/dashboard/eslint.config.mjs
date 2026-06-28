import { config } from '@repo/eslint-config/base';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat();

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [...config, ...compat.extends('next/core-web-vitals')];

export default eslintConfig;
