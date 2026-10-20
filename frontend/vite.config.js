import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        strictPort: true
    },
    css: {
        preprocessorOptions: {
            scss: {
                additionalData: '@use "src/views/styleVars" as *;\n',
            },
            sass: {
                additionalData: '@use "src/views/styleVars" as *;\n',
            },
        },
    },
    resolve: {
        alias: {
            '@components': path.resolve('src/components'),
            '@icons': path.resolve('src/components/icons'),
            '@ui': path.resolve('src/components/ui'),
            '@services': path.resolve('src/services'),
            '@utils': path.resolve('src/utils')
        }
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.js'],
        include: ['**/*.test.jsx'],
        exclude: ['node_modules/**', 'test/selenium/**']
    }
});
