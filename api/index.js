import mod from '../dist/index.cjs';

export default async function handler(req, res) {
    const expressApp = mod.default || mod;
    return expressApp(req, res);
}
