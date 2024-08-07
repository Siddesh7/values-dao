import calculateAlignmentScore from "@/lib/calculate-alingment-score";
import connectToDatabase from "@/lib/connect-to-db";
import User from "@/models/user";
import axios from "axios";
import {NextRequest, NextResponse} from "next/server";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const targetFID = searchParams.get("targetFid");
  const userFID = searchParams.get("userFid");

  if (!targetFID || !userFID) {
    return NextResponse.json({
      status: 400,
      error: "target is required",
    });
  }

  try {
    await connectToDatabase();
    let targetUser = await User.findOne({farcaster: targetFID});
    let user = await User.findOne({farcaster: userFID});
    console.log("targetUser", targetUser);
    console.log("user", user);
    if (
      !targetUser ||
      ((targetUser.aiGeneratedValues.warpcast === undefined ||
        targetUser.aiGeneratedValues.warpcast.length === 0) &&
        (targetUser.aiGeneratedValues.twitter === undefined ||
          targetUser.aiGeneratedValues.twitter.length === 0))
    ) {
      const {data} = await axios.get(
        `${process.env.NEXT_PUBLIC_HOST}/api/v2/generate-user-value?fid=${targetFID}&includeweights=true`,
        {
          headers: {
            "x-api-key": process.env.NEXT_PUBLIC_NEXT_API_KEY,
          },
        }
      );
      console.log("data", data);
      if (data.status === 403) {
        return NextResponse.json({
          status: 403,
          error: `User with FID ${targetFID} has less than 100 casts`,
        });
      }
      targetUser = data.user;
    }
    if (
      !user ||
      ((user.aiGeneratedValues.warpcast === undefined ||
        user.aiGeneratedValues.warpcast.length === 0) &&
        (user.aiGeneratedValues.twitter === undefined ||
          user.aiGeneratedValues.twitter.length === 0))
    ) {
      const {data} = await axios.get(
        `${process.env.NEXT_PUBLIC_HOST}/api/v2/generate-user-value?fid=${userFID}&includeweights=true`,
        {
          headers: {
            "x-api-key": process.env.NEXT_PUBLIC_NEXT_API_KEY,
          },
        }
      );
      if (data.status === 403) {
        return NextResponse.json({
          status: 403,
          error: `User with FID ${userFID} has less than 100 casts`,
        });
      }
      user = data.user;
    }

    user = {
      generatedValues:
        Object.keys(user?.aiGeneratedValuesWithWeights?.warpcast).length ===
          0 || user?.aiGeneratedValuesWithWeights?.warpcast === undefined
          ? {
              ...user?.aiGeneratedValues?.warpcast?.reduce(
                (acc: Record<string, number>, value: string) => {
                  acc[value] = 100;
                  return acc;
                },
                {}
              ),
              ...user?.aiGeneratedValues?.twitter?.reduce(
                (acc: Record<string, number>, value: string) => {
                  acc[value] = 100;
                  return acc;
                },
                {}
              ),
            }
          : {
              ...user?.aiGeneratedValuesWithWeights?.warpcast,
              ...user?.aiGeneratedValuesWithWeights?.twitter,
            },
    };
    console.log(user);
    targetUser = {
      generatedValues:
        Object.keys(targetUser?.aiGeneratedValuesWithWeights?.warpcast)
          .length === 0 ||
        targetUser?.aiGeneratedValuesWithWeights?.warpcast === undefined
          ? {
              ...targetUser?.aiGeneratedValues?.warpcast?.reduce(
                (acc: Record<string, number>, value: string) => {
                  acc[value] = 100;
                  return acc;
                },
                {}
              ),
              ...targetUser?.aiGeneratedValues?.twitter?.reduce(
                (acc: Record<string, number>, value: string) => {
                  acc[value] = 100;
                  return acc;
                },
                {}
              ),
            }
          : {
              ...targetUser?.aiGeneratedValuesWithWeights?.warpcast,
              ...targetUser?.aiGeneratedValuesWithWeights?.twitter,
            },
    };
    console.log(targetUser);
    const userRecommendation = calculateAlignmentScore(
      user,
      [targetUser],
      true
    );
    if (userRecommendation.error) {
      console.error("Error:", userRecommendation.error);
      return NextResponse.json({
        status: 500,
        error: userRecommendation.error || "Internal server error",
      });
    }

    return NextResponse.json({
      status: 200,

      // targetToUserAlignment: userRecommendation[0].targetToUserScore,
      alignmentPercent:
        userRecommendation?.alignmentScores[0].targetToUserScore,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({
      status: 500,
      error: error || "Internal server error",
    });
  }
}
