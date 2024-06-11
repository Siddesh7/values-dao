import User, {IUser} from "@/models/user";
import {NextRequest, NextResponse} from "next/server";
import {generateInviteCodes} from "@/lib/generate-invite-code";
import InviteCodes from "@/models/inviteCodes";
import {headers} from "next/headers";
import validateApiKey from "@/lib/validate-key";
import connectToDatabase from "@/lib/connect-to-db";

export async function POST(req: NextRequest) {
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
    const {
      email,
      wallets = [],
      method,
      mintedValues,
      balance,
      type,
      farcaster,
      twitter,
    } = await req.json();

    if (!method) {
      return NextResponse.json({error: "Method is required", status: 400});
    }
    if (!email && !farcaster) {
      return NextResponse.json({
        error: "Email or farcaster is required",
        status: 400,
      });
    }
    let user;
    if (email) {
      user = await User.findOne({email});
    } else if (farcaster) {
      user = await User.findOne({farcaster});
    }

    // Handle different methods
    switch (method) {
      case "create_user":
        if (user) {
          return NextResponse.json({error: "User already exists", status: 400});
        }
        const codes = generateInviteCodes();
        console.log({
          wallets,
          balance: 5,
          isVerified: true,
          inviteCodes: codes.map((inviteCode) => ({code: inviteCode})),

          ...(email ? {email} : farcaster ? {farcaster} : {}),
          mintedValues: mintedValues || [],
        });
        const createdUser = await User.create({
          wallets,
          balance: 5,
          isVerified: true,
          inviteCodes: codes.map((inviteCode) => ({code: inviteCode})),

          ...(email ? {email} : farcaster ? {farcaster} : {}),
          mintedValues: mintedValues || [],
        });

        const inviteCodesData = codes.map((inviteCode) => ({
          code: inviteCode,
          codeOwner: email,
        }));
        await InviteCodes.insertMany(inviteCodesData);

        return NextResponse.json(createdUser);
      case "update":
        if (!user) {
          return NextResponse.json({
            user: null,
            error: "User not found",
            status: 404,
          });
        }
        if (mintedValues) {
          user.mintedValues.push(...mintedValues);
        }
        if (farcaster) {
          user.farcaster = Number(farcaster);
        }
        if (balance) {
          user.balance =
            type === "add" ? user.balance + balance : user.balance - balance;
        }
        if (twitter) {
          user.twitter = twitter;
        }
        if (farcaster) {
          user.farcaster = farcaster;
        }
        await user.save();

        return NextResponse.json({user, status: 200});
      case "add_wallet":
        if (!user) {
          return NextResponse.json({
            user: null,
            error: "User not found",
            status: 404,
          });
        }
        for (const w of wallets) {
          if (!user.wallets.includes(w)) user.wallets.push(w);
        }
        await user.save();
        return NextResponse.json({user, status: 200});
      default:
        return NextResponse.json({error: "Invalid method", status: 400});
    }
  } catch (error) {
    return NextResponse.json({
      error: error || "Internal Server Error",
      status: 500,
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const apiKey = headers().get("x-api-key");
    const {isValid, message, status} = await validateApiKey(apiKey, "READ");
    if (!isValid) {
      return NextResponse.json({
        status: status,
        error: message,
      });
    }
    const searchParams = req.nextUrl.searchParams;
    const email = searchParams.get("email");
    const fid = searchParams.get("fid");

    if (email && fid) {
      const user = await User.findOne({email, farcaster: fid});
      if (!user) {
        return NextResponse.json({error: "User not found", status: 404});
      }
      return NextResponse.json({user, status: 200});
    } else if (email) {
      const user = await User.findOne({email});
      if (!user) {
        return NextResponse.json({error: "User not found", status: 404});
      }
      return NextResponse.json({user, status: 200});
    } else if (fid) {
      const user = await User.findOne({farcaster: fid});
      if (!user) {
        return NextResponse.json({error: "User not found", status: 404});
      }
      return NextResponse.json({user, status: 200});
    } else {
      const users = await User.find({});
      return NextResponse.json({users, status: 200});
    }
  } catch (error) {
    return NextResponse.json({
      error: error || "Internal Server Error",
      status: 500,
    });
  }
}

export async function PATCH(req: NextRequest) {
  const {email, farcaster, method, values, type, txHash} = await req.json();
  if (!email && !farcaster) {
    return NextResponse.json({
      error: "Email or farcaster is required",
      status: 400,
    });
  }

  if (Array.isArray(values) && values.length === 0) {
    return NextResponse.json({
      error: "Values is required",
      status: 400,
    });
  }
  if (!Array.isArray(values)) {
    return NextResponse.json({
      error: "Values must be an array",
      status: 400,
    });
  }
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

    const user = await User.findOne({
      ...(email ? {email} : farcaster ? {farcaster} : {}),
    });

    if (!user) {
      return NextResponse.json({
        error: "User not found",
        user: null,
        status: 404,
      });
    }

    if (method === "update_user_value" && type === "burn") {
      for (const value of values) {
        const index = user.mintedValues.findIndex(
          (v: any) => v.value === value
        );

        if (index !== -1) {
          console.log("Removing value from minted values");
          user.mintedValues.splice(index, 1);
        }
        user.burntValues.push({
          value,
          txHash: txHash || "",
        });
      }
      await user.save();
      return NextResponse.json({
        user,
        status: 200,
        message: "Values burnt successfully",
      });
    }
    return NextResponse.json({
      user: null,
      error: "Method not provided",
      status: 405,
    });
  } catch (error) {
    return NextResponse.json({
      user: null,
      error: error || "Internal Server Error",
      status: 500,
    });
  }
}
