"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { parseEther, formatEther } from "viem";
import { ArrowLeftIcon, MapPinIcon, CurrencyDollarIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldWriteContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const BuyInsurance: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  
  // Form state
  const [cropType, setCropType] = useState("");
  const [coverage, setCoverage] = useState("1");
  const [duration, setDuration] = useState("30");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [premium, setPremium] = useState<bigint | null>(null);

  // Contract interactions
  const { writeContractAsync: createPolicy, isPending: isCreatingPolicy } = useScaffoldWriteContract("RadiShield");
  
  // Use read contract for calculatePremium since it's a view function
  // calculatePremium expects pre-scaled coordinates (multiplied by 10000)
  // So for -1.2921, we pass -12921 (scaled by 10000)
  const { data: calculatedPremium, refetch: refetchPremium, isLoading: isCalculatingPremium } = useScaffoldReadContract({
    contractName: "RadiShield",
    functionName: "calculatePremium",
    args: coverage && latitude && longitude ? [
      parseEther(coverage),
      BigInt(Math.round(parseFloat(latitude) * 10000)),
      BigInt(Math.round(parseFloat(longitude) * 10000))
    ] : undefined,
  });

  // Calculate premium when form changes
  const handleCalculatePremium = async () => {
    if (!coverage || !latitude || !longitude) return;
    
    try {
      const result = await refetchPremium();
      if (result.data) {
        setPremium(result.data as bigint);
      }
    } catch (error) {
      console.error("Error calculating premium:", error);
    }
  };

  // Create insurance policy
  const handleCreatePolicy = async () => {
    if (!cropType || !coverage || !duration || !latitude || !longitude || !premium) {
      alert("Please fill all fields and calculate premium first");
      return;
    }

    // Validate African coordinates
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (lat < -35 || lat > 37 || lon < -18 || lon > 52) {
      alert("Coordinates must be within Africa: Latitude -35° to 37°, Longitude -18° to 52°");
      return;
    }

    try {
      const coverageWei = parseEther(coverage);
      const durationSeconds = BigInt(parseInt(duration) * 24 * 60 * 60); // Convert days to seconds
      // createPolicy expects coordinates as simple integers (degrees)
      // The contract will scale them by 10000 internally
      // So -1.2921 becomes -1, and 36.8219 becomes 37 (rounded to nearest integer)
      const lat = BigInt(Math.round(parseFloat(latitude)));
      const lon = BigInt(Math.round(parseFloat(longitude)));

      await createPolicy({
        functionName: "createPolicy",
        args: [cropType, coverageWei, durationSeconds, lat, lon],
        value: premium,
      });

      alert("Insurance policy created successfully!");
      // Reset form
      setCropType("");
      setCoverage("1");
      setDuration("30");
      setLatitude("");
      setLongitude("");
      setPremium(null);
    } catch (error) {
      console.error("Error creating policy:", error);
      alert("Error creating policy. Please try again.");
    }
  };

  // Get user's location
  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toString());
          setLongitude(position.coords.longitude.toString());
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Could not get your location. Please enter coordinates manually.");
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  if (!connectedAddress) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Connect Your Wallet</h1>
          <p className="text-base-content/70">Please connect your wallet to buy insurance</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center mb-8">
        <Link href="/" className="btn btn-ghost btn-sm mr-4">
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </Link>
        <h1 className="text-3xl font-bold">Buy Crop Insurance</h1>
      </div>

      {/* Connected Address */}
      <div className="bg-base-100 p-4 rounded-lg mb-6">
        <p className="text-sm text-base-content/70 mb-2">Connected as:</p>
        <Address address={connectedAddress} />
      </div>

      {/* Insurance Form */}
      <div className="bg-base-100 p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-6">Policy Details</h2>
        
        {/* Crop Type */}
        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text font-medium">Crop Type</span>
          </label>
          <select 
            className="select select-bordered w-full"
            value={cropType}
            onChange={(e) => setCropType(e.target.value)}
          >
            <option value="">Select crop type</option>
            <option value="maize">Maize</option>
            <option value="coffee">Coffee</option>
            <option value="tea">Tea</option>
            <option value="rice">Rice</option>
            <option value="wheat">Wheat</option>
            <option value="cassava">Cassava</option>
            <option value="beans">Beans</option>
            <option value="sorghum">Sorghum</option>
          </select>
        </div>

        {/* Coverage Amount */}
        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text font-medium">Coverage Amount (C2FLR)</span>
            <span className="label-text-alt">Min: 1 C2FLR, Max: 10 C2FLR</span>
          </label>
          <input
            type="number"
            min="1"
            max="10"
            step="0.1"
            className="input input-bordered w-full"
            value={coverage}
            onChange={(e) => setCoverage(e.target.value)}
            placeholder="Enter coverage amount"
          />
        </div>

        {/* Duration */}
        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text font-medium">Duration (Days)</span>
            <span className="label-text-alt">Min: 30 days, Max: 365 days</span>
          </label>
          <input
            type="number"
            min="30"
            max="365"
            className="input input-bordered w-full"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="Enter duration in days"
          />
        </div>

        {/* Location */}
        <div className="mb-6">
          <label className="label">
            <span className="label-text font-medium">Farm Location (Africa Only)</span>
            <span className="label-text-alt">Lat: -35° to 37°, Lon: -18° to 52°</span>
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="number"
              step="0.000001"
              className="input input-bordered flex-1"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="Latitude (e.g., -1.292 for Nairobi)"
            />
            <input
              type="number"
              step="0.000001"
              className="input input-bordered flex-1"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="Longitude (e.g., 36.822 for Nairobi)"
            />
          </div>
          <button 
            type="button" 
            className="btn btn-outline btn-sm"
            onClick={handleGetLocation}
          >
            <MapPinIcon className="h-4 w-4 mr-2" />
            Use My Location
          </button>
        </div>

        {/* Premium Calculation */}
        <div className="bg-base-200 p-4 rounded-lg mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium">Premium Calculation</span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleCalculatePremium}
              disabled={isCalculatingPremium || !coverage || !latitude || !longitude}
            >
              {isCalculatingPremium ? "Calculating..." : "Calculate Premium"}
            </button>
          </div>
          {premium && (
            <div className="text-lg font-bold text-primary">
              Premium: {formatEther(premium)} C2FLR
            </div>
          )}
        </div>

        {/* Create Policy Button */}
        <button
          type="button"
          className="btn btn-success w-full"
          onClick={handleCreatePolicy}
          disabled={isCreatingPolicy || !premium}
        >
          {isCreatingPolicy ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              Creating Policy...
            </>
          ) : (
            <>
              <CurrencyDollarIcon className="h-5 w-5 mr-2" />
              Create Insurance Policy
            </>
          )}
        </button>

        {/* Info */}
        <div className="mt-6 p-4 bg-info/10 rounded-lg">
          <h3 className="font-bold text-info mb-2">Coverage Information</h3>
          <ul className="text-sm text-base-content/70 space-y-1">
            <li>• Severe Drought: &lt;5mm rainfall in 30 days (100% payout)</li>
            <li>• Severe Flood: &gt;200mm rainfall in 24 hours (100% payout)</li>
            <li>• Extreme Heatwave: &gt;55°C temperature (75% payout)</li>
            <li>• Automatic payouts based on weather data</li>
            <li>• Coverage limited to African coordinates</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BuyInsurance;