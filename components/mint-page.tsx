"use client";
import {useEffect, useState} from "react";
import Image from "next/image";
import Link from "next/link";
import GenerateNewValueCard from "@/components/generate-new-value-card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {ToastAction} from "@/components/ui/toast";
import {toast} from "@/components/ui/use-toast";
import ValuesWordCloud from "@/components/ui/values-word-cloud";

import {useUserContext} from "@/providers/user-context-provider";
import {IValuesData} from "@/types";

import {SearchIcon, Twitter} from "lucide-react";
import {usePrivy} from "@privy-io/react-auth";
import {privateKeyToAccount} from "viem/accounts";
import {useAccount, useWriteContract} from "wagmi";
import {getAddress} from "viem";
import useValues from "@/app/hooks/useValues";
import {NFT_CONTRACT_ABI, NFT_CONTRACT_ADDRESS} from "@/lib/constants";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import ValuePage from "@/app/value/page";
import Projects from "./projects";

const MintPage = () => {
  const {updateUser, updateValue, addWallet} = useValues();
  const {userInfo, setUserInfo, valuesAvailable, setValuesAvailable} =
    useUserContext();
  const {user, linkWallet, login, ready, authenticated, linkEmail} = usePrivy();

  const {writeContractAsync} = useWriteContract();

  const {address} = useAccount();
  const [valueMinted, setValueMinted] = useState<{
    value: string;
    hash: string;
    showSuccessModal: boolean;
  }>();
  const [filteredData, setFilteredData] = useState({});
  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState<{[key: string]: boolean}>({});

  const [showGenerateNewValueCard, setShowGenerateNewValueCard] =
    useState(false);

  const mintValue = async ({value, key}: {value: any; key: string}) => {
    if (!value || !key || !userInfo) return;
    const walletToUse = address ?? userInfo.wallets?.[0];

    if (walletToUse === undefined) {
      toast({
        title: "Please connect your wallet",
        description: "To mint values, connect a wallet first",
      });
      return;
    }

    if (userInfo?.balance && userInfo.balance > 0) {
      setLoading((prevLoading) => ({
        ...prevLoading,
        [key]: true,
      }));
      try {
        const hash = await writeContractAsync({
          abi: NFT_CONTRACT_ABI,
          address: NFT_CONTRACT_ADDRESS,
          functionName: "safeMint",
          args: [getAddress(walletToUse), value.cid],
          account: privateKeyToAccount(
            process.env.NEXT_PUBLIC_ADMIN_WALLET_PRIVATE_KEY as `0x${string}`
          ),
          chainId: 84532,
        });

        if (hash) {
          setValueMinted({value: key, hash, showSuccessModal: true});

          await updateUser({
            values: [
              {
                value: key,
                txHash: hash,
              },
            ],

            balance: 1,
            type: "sub",
          });

          await updateValue({value: key});
          addWallet({wallets: [walletToUse]});
          setUserInfo({
            ...userInfo,
            balance: userInfo.balance - 1,
            mintedValues: [
              ...(userInfo.mintedValues ?? []),
              {
                value: key,
                txHash: hash,
              },
            ],
          });

          const newValuesAvailable = ((
            prevValues: IValuesData
          ): IValuesData => {
            const newMinters = [
              ...(prevValues[key]?.minters || []),
              ...(typeof userInfo.email === "string" ? [userInfo.email] : []),
              ...(typeof userInfo.farcaster === "string"
                ? [userInfo.farcaster]
                : []),
            ];
            return {
              ...prevValues,
              [key]: {
                ...prevValues[key],
                minters: newMinters,
              },
            };
          })(valuesAvailable || {});

          setValuesAvailable(newValuesAvailable);
          toast({
            title: `We just dropped few NFTs to your wallet`,
            description: `View them in your wallet (${walletToUse.slice(
              0,
              7
            )}...${walletToUse.slice(-4)})`,
            action: (
              <ToastAction
                altText="opensea"
                onClick={() => {
                  window.open(
                    `${process.env.NEXT_PUBLIC_BASESCAN_URL}/tx/${hash}`,
                    "_blank"
                  );
                }}
              >
                Basescan
              </ToastAction>
            ),
          });
        } else {
          toast({
            title: "Failed to mint value",
            description: "Please try again",
          });
        }
      } catch (error) {
        console.error("Error minting value", error);
        toast({
          title: "Failed to mint value",
          description: "Please try again",
        });
      }

      setLoading((prevLoading) => ({
        ...prevLoading,
        [key]: false,
      }));
    } else {
      toast({
        title: "Deposit funds to mint",
        description: "You don't have enough funds to mint this value",
      });
    }
    setSearchValue("");
  };
  // filter values upon search by user and set it in a state to display in UI
  const hasMintedValue = async (value: string) => {
    if (
      !value ||
      !userInfo ||
      !userInfo.mintedValues ||
      userInfo.mintedValues.length === 0
    )
      return false;
    return userInfo.mintedValues.some(
      (obj: {value: string; txHash: string}) => obj.value === value
    );
  };
  const filteredDataPromises = Object.entries(
    valuesAvailable ?? ({} as IValuesData)
  )
    .filter(([key]) => key.includes(searchValue.toLowerCase()))
    .map(async ([key, value]) => {
      const hasMintedValueBefore = await hasMintedValue(key);
      return [key, {value, hasMintedValue: hasMintedValueBefore}];
    });
  const fetchData = async () => {
    const filteredData = Object.fromEntries(
      await Promise.all(filteredDataPromises)
    );
    setFilteredData(filteredData);
  };

  useEffect(() => {
    fetchData();
  }, [searchValue, userInfo]);

  return (
    <div className="flex justify-center">
      <div className="flex flex-col md:w-[900px] w-[98vw] max-w-[98%] m-auto">
        <ValuesWordCloud refresh={valuesAvailable} />

        <Tabs className="w-[96%] m-auto">
          <TabsList className="flex justify-center bg-primary text-primary-foreground  bg-white py-8 md:py-4">
            <TabsTrigger
              value="ai"
              className="text-md text-wrap md:text-lg font-semibold  py-[3px]"
            >
              AI Value Analysis
            </TabsTrigger>{" "}
            <TabsTrigger
              value="community"
              className="text-md text-wrap md:text-lg font-semibold  py-[3px]"
            >
              Community Mint
            </TabsTrigger>
            <TabsTrigger
              value="manual"
              className="text-md text-wrap md:text-lg font-semibold  py-[3px]"
            >
              Manual Mint
            </TabsTrigger>
          </TabsList>
          <TabsContent value="manual">
            <h2 className="scroll-m-20 py-4 text-center border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 max-w-5xl text-muted-foreground mb-2">
              ||manual mint
            </h2>
            <div className="flex flex-row justify-between items-center ">
              <p className="p-4">Balance: ${userInfo?.balance ?? 0}</p>
            </div>
            <div className="relative ">
              <Input
                placeholder="Search for values"
                className="w-full h-12 "
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />

              <div className="absolute inset-y-0 right-3 pl-3 flex items-center cursor-pointer">
                <SearchIcon className="h-5 w-5 text-gray-400" />
              </div>
            </div>
            {authenticated ? (
              <>
                {(user?.email?.address || user?.farcaster?.fid) && (
                  <section>
                    {!showGenerateNewValueCard &&
                      searchValue.length > 0 &&
                      filteredData &&
                      Object.entries(filteredData).map(
                        ([key, value]: [any, any]) => {
                          return (
                            <div
                              key={key}
                              className="w-full h-14 px-3 flex items-center hover:bg-gray-300/20 hover:cursor-pointer rounded-sm"
                            >
                              <span> {key}</span>

                              {address ||
                              (userInfo &&
                                userInfo.wallets &&
                                userInfo.wallets?.length > 0) ? (
                                <Button
                                  variant="default"
                                  className="ml-auto h-8 w-32"
                                  disabled={
                                    value.hasMintedValue || loading[key]
                                  }
                                  onClick={() => {
                                    mintValue({value: value.value, key});
                                  }}
                                >
                                  {loading[key] ? (
                                    <div className="animate-spin rounded-full h-6 w-6 border-4 border-dashed border-white"></div>
                                  ) : (
                                    <>
                                      {value.hasMintedValue
                                        ? "Already Minted"
                                        : "Mint"}
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <div className="ml-auto">
                                  <Button
                                    variant="default"
                                    onClick={linkWallet}
                                  >
                                    Connect Wallet
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        }
                      )}
                    {!showGenerateNewValueCard &&
                      searchValue.length > 0 &&
                      Object.entries(filteredData).length !== 0 && (
                        <div className="w-full h-14 px-3 flex items-center hover:bg-gray-300/20 hover:cursor-pointer rounded-sm">
                          <span className=" text-gray-300 text-md">
                            Not finding what you are looking for?
                          </span>{" "}
                          <Button
                            variant="default"
                            onClick={() => {
                              setShowGenerateNewValueCard(true);
                            }}
                            className="ml-auto h-8 w-32"
                          >
                            Mint your value
                          </Button>
                        </div>
                      )}

                    {searchValue.length > 0 &&
                      (showGenerateNewValueCard ||
                        Object.entries(filteredData).length === 0) && (
                        <GenerateNewValueCard
                          value={searchValue}
                          mint={mintValue}
                        />
                      )}

                    {searchValue.length === 0 && (
                      <div className="flex justify-center items-center p-4">
                        <span className="font-semibold  text-gray-300 text-lg">
                          Type out your values and mint them
                        </span>{" "}
                      </div>
                    )}
                  </section>
                )}
              </>
            ) : (
              <section className="md:w-[900px] pl-4 h-14  flex flex-row justify-between items-center hover:bg-gray-300/20 hover:cursor-pointer rounded-sm mt-4">
                <span className="font-semibold  text-gray-300 text-lg">
                  Login to proceed
                </span>
                <Button variant="default" onClick={login}>
                  Login
                </Button>
              </section>
            )}
          </TabsContent>
          <TabsContent value="ai">
            <ValuePage />
          </TabsContent>
          <TabsContent value="community">
            <Projects
              limit={3}
              style="grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            />
          </TabsContent>
        </Tabs>

        {valueMinted && (
          <AlertDialog open={valueMinted.showSuccessModal}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  We just minted these values to your wallet.
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {valueMinted.value}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    setValueMinted({...valueMinted, showSuccessModal: false});
                  }}
                >
                  Close
                </AlertDialogCancel>
                <div className="flex flex-row gap-2">
                  <Link
                    href="https://warpcast.com/~/compose?text=I%20just%20minted%20my%20values%20on%20ValuesDAO.%20Check%20if%20you%27re%20aligned%20with%20me%2C%20anon%3F%20&embeds[]=https://app.valuesdao.io"
                    target="_blank"
                  >
                    <Button className="flex flex-row w-full">
                      Share
                      <Image
                        src="/white-purple.png"
                        width={20}
                        height={20}
                        alt="farcaster"
                        className="mx-2"
                      />
                    </Button>
                  </Link>
                  <Link
                    href="https://twitter.com/intent/tweet?url=https%3A%2F%2Fapp.valuesdao.io%2F&text=I%20just%20minted%20my%20values%20on%20ValuesDAO.%20Check%20if%20you%27re%20aligned%20with%20me%2C%20anon%3F"
                    target="_blank"
                  >
                    <Button className="flex flex-row w-full">
                      Tweet
                      <Twitter
                        strokeWidth={0}
                        fill="#1DA1F2"
                        className="h-6 w-6 ml-2"
                      />
                    </Button>
                  </Link>
                </div>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
};

export default MintPage;
