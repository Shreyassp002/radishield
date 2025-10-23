"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import {
  BoltIcon,
  CheckCircleIcon,
  CloudIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  ShieldCheckIcon,
  SunIcon,
} from "@heroicons/react/24/outline";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const Home: NextPage = () => {
  const [isLoaded, setIsLoaded] = useState(false);

  // Read contract stats
  const { data: contractStats } = useScaffoldReadContract({
    contractName: "RadiShield",
    functionName: "getContractStats",
  });

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <>
      {/* Hero Section */}
      <div className="relative py-16 sm:py-20 lg:py-24 overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <div className={`max-w-4xl mx-auto ${isLoaded ? "animate-fade-in" : "opacity-0"}`}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold bg-gradient-to-r from-gray-900 via-primary to-gray-900 bg-clip-text text-transparent mb-4 sm:mb-6 leading-tight">
              RadiShield
            </h1>
            <p className="text-lg sm:text-xl lg:text-2xl text-gray-600 mb-3 sm:mb-4 font-medium">
              Weather Insurance for African Farmers
            </p>
            <p className="text-base sm:text-lg text-gray-500 mb-8 sm:mb-10 max-w-3xl mx-auto leading-relaxed px-2">
              Parametric crop insurance powered by blockchain technology and real-time weather data
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/buy-insurance" className="btn btn-primary px-8 py-3 text-lg font-semibold">
                Buy Insurance
              </Link>
              <Link
                href="/my-policies"
                className="btn btn-ghost px-8 py-3 text-lg font-semibold border border-gray-300 hover:border-primary"
              >
                My Policies
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Contract Stats */}
      {contractStats && (
        <div className="py-16 bg-gradient-to-r from-gray-50 to-white">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Platform Impact</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">Real numbers from our insurance platform</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="stat-card group">
                <div className="bg-gradient-to-br from-primary/20 to-primary/10 p-4 rounded-2xl w-fit mx-auto mb-4">
                  <div className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    {contractStats[0]?.toString() || "0"}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Total Policies</h3>
                <p className="text-gray-600 text-sm">Farmers protected</p>
              </div>
              <div className="stat-card group">
                <div className="bg-gradient-to-br from-secondary/20 to-secondary/10 p-4 rounded-2xl w-fit mx-auto mb-4">
                  <div className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    {contractStats[1]?.toString() || "0"}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Active Policies</h3>
                <p className="text-gray-600 text-sm">Currently protected</p>
              </div>
              <div className="stat-card group">
                <div className="bg-gradient-to-br from-green-500/20 to-green-400/10 p-4 rounded-2xl w-fit mx-auto mb-4">
                  <div className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    {contractStats[2]?.toString() || "0"}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Claims Paid</h3>
                <p className="text-gray-600 text-sm">Automatic payouts</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Services Section */}
      <div className="py-16">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Insurance Solutions</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Comprehensive protection for African agricultural needs
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Buy Insurance Card */}
            <div className="card p-6 text-center h-full flex flex-col group hover:shadow-xl transition-all duration-300">
              <div className="bg-gradient-to-br from-primary/20 to-primary/10 p-4 rounded-2xl w-fit mx-auto mb-4 group-hover:scale-105 transition-transform duration-300">
                <ShieldCheckIcon className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Buy Insurance</h3>
              <p className="text-gray-600 mb-6 flex-grow text-sm">
                Protect your crops against extreme weather with parametric insurance
              </p>
              <div className="space-y-2 mb-6 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <CheckCircleIcon className="h-4 w-4 text-green-500" />
                  <span>Automatic payouts</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <CheckCircleIcon className="h-4 w-4 text-green-500" />
                  <span>No paperwork</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <CheckCircleIcon className="h-4 w-4 text-green-500" />
                  <span>Blockchain transparency</span>
                </div>
              </div>
              <Link href="/buy-insurance" className="btn btn-primary w-full">
                Get Protected
              </Link>
            </div>

            {/* My Policies Card */}
            <div className="card p-6 text-center h-full flex flex-col group hover:shadow-xl transition-all duration-300">
              <div className="bg-gradient-to-br from-secondary/20 to-secondary/10 p-4 rounded-2xl w-fit mx-auto mb-4 group-hover:scale-105 transition-transform duration-300">
                <CurrencyDollarIcon className="h-12 w-12 text-secondary" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">My Policies</h3>
              <p className="text-gray-600 mb-6 flex-grow text-sm">
                Monitor policies, track weather, and view payout history
              </p>
              <div className="space-y-2 mb-6 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <CheckCircleIcon className="h-4 w-4 text-green-500" />
                  <span>Real-time status</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <CheckCircleIcon className="h-4 w-4 text-green-500" />
                  <span>Weather monitoring</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <CheckCircleIcon className="h-4 w-4 text-green-500" />
                  <span>Payout tracking</span>
                </div>
              </div>
              <Link href="/my-policies" className="btn btn-primary w-full">
                View Policies
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="py-16 bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Three simple steps to protect your crops</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center group">
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-400/10 p-4 rounded-2xl w-fit mx-auto mb-4 group-hover:scale-105 transition-all duration-300">
                <MapPinIcon className="h-12 w-12 text-blue-500" />
              </div>
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-bold px-4 py-2 rounded-full w-fit mx-auto mb-4">
                STEP 1
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Set Location</h3>
              <p className="text-gray-600 text-sm">Enter farm coordinates and crop type for Africa coverage</p>
            </div>

            <div className="text-center group">
              <div className="bg-gradient-to-br from-primary/20 to-primary/10 p-4 rounded-2xl w-fit mx-auto mb-4 group-hover:scale-105 transition-all duration-300">
                <ShieldCheckIcon className="h-12 w-12 text-primary" />
              </div>
              <div className="bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold px-4 py-2 rounded-full w-fit mx-auto mb-4">
                STEP 2
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Choose Coverage</h3>
              <p className="text-gray-600 text-sm">Select coverage amount and duration, pay 7% premium</p>
            </div>

            <div className="text-center group">
              <div className="bg-gradient-to-br from-green-500/20 to-green-400/10 p-4 rounded-2xl w-fit mx-auto mb-4 group-hover:scale-105 transition-all duration-300">
                <CurrencyDollarIcon className="h-12 w-12 text-green-500" />
              </div>
              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white text-xs font-bold px-4 py-2 rounded-full w-fit mx-auto mb-4">
                STEP 3
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Get Payouts</h3>
              <p className="text-gray-600 text-sm">Automatic payouts when weather triggers are met</p>
            </div>
          </div>
        </div>
      </div>

      {/* Weather Coverage Section */}
      <div className="py-16">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Weather Protection</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Coverage against damaging weather events</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="card p-6 text-center group hover:shadow-xl transition-all duration-300">
              <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/10 p-4 rounded-2xl w-fit mx-auto mb-4 group-hover:scale-105 transition-transform duration-300">
                <SunIcon className="h-12 w-12 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Severe Drought</h3>
              <p className="text-gray-600 mb-4 text-sm">&lt;5mm rainfall in 30 days</p>
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-semibold">
                100% Payout
              </div>
            </div>

            <div className="card p-6 text-center group hover:shadow-xl transition-all duration-300">
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 p-4 rounded-2xl w-fit mx-auto mb-4 group-hover:scale-105 transition-transform duration-300">
                <CloudIcon className="h-12 w-12 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Severe Flood</h3>
              <p className="text-gray-600 mb-4 text-sm">&gt;200mm rainfall in 24 hours</p>
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-semibold">
                100% Payout
              </div>
            </div>

            <div className="card p-6 text-center group hover:shadow-xl transition-all duration-300">
              <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 p-4 rounded-2xl w-fit mx-auto mb-4 group-hover:scale-105 transition-transform duration-300">
                <BoltIcon className="h-12 w-12 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Extreme Heat</h3>
              <p className="text-gray-600 mb-4 text-sm">&gt;55°C temperature</p>
              <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-semibold">
                75% Payout
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
