"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hardhat } from "viem/chains";
import { Bars3Icon, CurrencyDollarIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useOutsideClick, useTargetNetwork } from "~~/hooks/scaffold-eth";

type HeaderMenuLink = {
  label: string;
  href: string;
  icon?: React.ReactNode;
};

export const menuLinks: HeaderMenuLink[] = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "Buy Insurance",
    href: "/buy-insurance",
    icon: <ShieldCheckIcon className="h-4 w-4" />,
  },
  {
    label: "My Policies",
    href: "/my-policies",
    icon: <CurrencyDollarIcon className="h-4 w-4" />,
  },
];

export const HeaderMenuLinks = () => {
  const pathname = usePathname();

  return (
    <>
      {menuLinks.map(({ label, href, icon }) => {
        const isActive = pathname === href;
        return (
          <li key={href} className="list-none">
            <Link
              href={href}
              className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 relative overflow-hidden group ${
                isActive
                  ? "bg-gradient-to-r from-primary to-secondary text-white shadow-lg"
                  : "text-gray-700 hover:bg-primary/10 hover:text-primary hover:shadow-md"
              }`}
            >
              {icon && <span className="group-hover:scale-110 transition-transform duration-300">{icon}</span>}
              <span className="relative z-10">{label}</span>
              {!isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              )}
            </Link>
          </li>
        );
      })}
    </>
  );
};

/**
 * Site header
 */
export const Header = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;

  const burgerMenuRef = useRef<HTMLDetailsElement>(null);
  useOutsideClick(burgerMenuRef, () => {
    burgerMenuRef?.current?.removeAttribute("open");
  });

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-18">
          {/* Mobile Menu Button */}
          <details className="dropdown lg:hidden" ref={burgerMenuRef}>
            <summary className="btn btn-ghost btn-sm hover:bg-primary/10 transition-all duration-300">
              <Bars3Icon className="h-5 w-5" />
            </summary>
            <ul
              className="menu dropdown-content mt-3 p-6 bg-white/95 backdrop-blur-md rounded-2xl w-72 border border-gray-200/50 shadow-xl"
              onClick={() => {
                burgerMenuRef?.current?.removeAttribute("open");
              }}
            >
              <HeaderMenuLinks />
            </ul>
          </details>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-4 group">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-2xl shadow-lg group-hover:scale-105 transition-all duration-300">
              <ShieldCheckIcon className="h-7 w-7 text-white" />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-bold text-xl text-gray-900 group-hover:text-primary transition-colors duration-300">
                RadiShield
              </span>
              <span className="text-sm text-gray-500 font-medium">Weather Insurance</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-2">
            <HeaderMenuLinks />
          </nav>

          {/* Wallet Connection */}
          <div className="flex items-center gap-4">
            <RainbowKitCustomConnectButton />
            {isLocalNetwork && <FaucetButton />}
          </div>
        </div>
      </div>
    </header>
  );
};
