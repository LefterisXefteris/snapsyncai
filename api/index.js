import mod from '../dist/index.cjs';

export const config = {
    maxDuration: 60, // Allow up to 60s for cold starts + AI analysis
};

export default async function handler(req, res) {
    const expressApp = mod.default || mod;
    return expressApp(req, res);
}
