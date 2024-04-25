"use client";
import Image from "next/image";
import React from "react";

import {Button} from "../ui/button";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {EllipsisVertical} from "lucide-react";
import {usePrivy} from "@privy-io/react-auth";

const Navbar = () => {
  const {ready, authenticated, user, logout, login} = usePrivy();
  return (
    <div className="flex flex-row justify-between  p-6 relative">
      <Link href="/">
        <Image
          src={"/logo.png"}
          alt="logo"
          width={80}
          height={80}
          className="w-[80px] h-[80px] "
        />
      </Link>

      <div className="hidden md:flex flex-row gap-4">
        <Button variant={"link"} className="text-md" asChild>
          <Link href={"/"}>Home</Link>
        </Button>
        <Button variant={"link"} className="text-md" asChild>
          <Link href={"/profile"}>Profile</Link>
        </Button>
        <Button variant={"link"} className="text-md" asChild>
          <Link href={"/mint"}>Mint a Value</Link>
        </Button>

        {ready && authenticated ? (
          <Button variant={"default"} onClick={logout}>
            Logout
          </Button>
        ) : (
          <Button onClick={login} disabled={!ready}>
            Login
          </Button>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="absolute top-5 right-4 flex flex-row gap-2 items-center md:hidden"
          asChild
        >
          <Button variant={"outline"} size={"icon"}>
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="mr-4">
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href={"/"}>Home</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href={"/profile"}>Profile</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href={"/mint"}>Mint a Value</Link>
          </DropdownMenuItem>

          {authenticated && user && (
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => logout()}
            >
              Logout
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default Navbar;
