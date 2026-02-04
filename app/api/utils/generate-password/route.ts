import { NextRequest, NextResponse } from 'next/server';
import { generatePassword } from '../../../../lib/utils/password-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate length
    const length = parseInt(body.length);
    if (isNaN(length) || length < 4 || length > 128) {
      return NextResponse.json(
        { error: 'Length must be a number between 4 and 128' },
        { status: 400 }
      );
    }

    const options = {
      length,
      includeUppercase: !!body.includeUppercase,
      includeLowercase: !!body.includeLowercase,
      includeNumbers: !!body.includeNumbers,
      includeSymbols: !!body.includeSymbols,
    };

    const password = generatePassword(options);

    return NextResponse.json({
      password,
      length: password.length,
      options
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}