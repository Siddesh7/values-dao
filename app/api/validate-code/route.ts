import connectToDatabase from "@/lib/connect-to-db";
import validateApiKey from "@/lib/validate-key";
import InviteCodes from "@/models/inviteCodes";
import User from "@/models/user";
import {headers} from "next/headers";
import {NextResponse} from "next/server";

export async function GET(req: any) {
  try {
    await connectToDatabase();
    const apiKey = headers().get("x-api-key");
    const {isValid, message, status} = await validateApiKey(apiKey, "WRITE");
    if (!isValid) {
      return NextResponse.json({
        status: status,
        error: message,
      });
    }

    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const email = searchParams.get("email");
    if (!code || !email) {
      return NextResponse.json({status: 400, error: "Invalid code or email"});
    }

    const existingCode = await InviteCodes.findOne({code});
    if (code === "farcon") {
      existingCode.claimedBy = (
        (Number(existingCode.claimedBy) ?? 0) + 1
      ).toString();
      await existingCode.save();
      const user = await User.findOneAndUpdate(
        {email},
        {isVerified: true},
        {new: true}
      );
      return NextResponse.json({status: 200, isValid: true});
    }
    if (!existingCode || existingCode.claimed) {
      return NextResponse.json({
        status: existingCode ? 400 : 404,
        isValid: false,
      });
    }

    existingCode.claimedBy = email;
    existingCode.claimed = true;
    await existingCode.save();

    const user = await User.findOneAndUpdate(
      {email},
      {isVerified: true},
      {new: true}
    );
    if (!user) {
      throw {message: "User not found", status: 404};
    }

    return NextResponse.json({status: 200, isValid: true});
  } catch (error) {
    return NextResponse.json({
      status: 500,
      error: error,
    });
  }
}
