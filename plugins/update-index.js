#!/usr/bin/env node
/**
 * 自动更新 plugins/index.json
 * 扫描 plugins/ 目录下的所有插件并生成索引文件
 * 
 * 使用方法: node plugins/update-index.js
 */

const fs = require('fs');
const path = require('path');

const pluginsDir = __dirname;

// 读取所有子目录
const items = fs.readdirSync(pluginsDir, { withFileTypes: true });
const pluginDirs = items.filter(item => item.isDirectory() && !item.name.startsWith('.'));

const plugins = [];

for (const dir of pluginDirs) {
    const pluginPath = path.join(pluginsDir, dir.name);
    const manifestPath = path.join(pluginPath, 'manifest.json');

    if (fs.existsSync(manifestPath)) {
        try {
            const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
            const manifest = JSON.parse(manifestContent);

            plugins.push({
                id: manifest.id || dir.name,
                name: manifest.name || dir.name,
                version: manifest.version || '1.0.0',
                description: manifest.description || '',
                author: manifest.author || '未知',
                manifest_url: `./${dir.name}/manifest.json`
            });

            console.log(`✓ 已索引: ${manifest.name || dir.name} (${dir.name})`);
        } catch (error) {
            console.warn(`✗ 解析失败: ${dir.name}/manifest.json - ${error.message}`);
        }
    } else {
        console.warn(`⊘ 跳过: ${dir.name} (无 manifest.json)`);
    }
}

// 写入 index.json
const indexPath = path.join(pluginsDir, 'index.json');
const indexContent = JSON.stringify({ plugins }, null, 2);
fs.writeFileSync(indexPath, indexContent, 'utf-8');

console.log(`\n✅ 已更新 plugins/index.json (${plugins.length} 个插件)`);
