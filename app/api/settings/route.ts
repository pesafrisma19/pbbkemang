import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const settingsPath = path.join(process.cwd(), 'lib', 'settings.json');

export async function GET() {
    try {
        if (!fs.existsSync(settingsPath)) {
            return NextResponse.json({ deadline: "" });
        }
        const data = fs.readFileSync(settingsPath, 'utf8');
        return NextResponse.json(JSON.parse(data));
    } catch (e) {
        return NextResponse.json({ deadline: "" });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const data = JSON.stringify(body, null, 2);
        
        // Ensure directory exists
        const dir = path.dirname(settingsPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(settingsPath, data, 'utf8');
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
