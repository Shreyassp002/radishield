"use client";

import { useState, useEffect } from "react";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { ArrowLeftIcon, ClockIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

interface Policy {
  id: bigint;
  farmer: string;
  cropType: string;
  coverage: bigint;
  premium: bigint;
  latitude: bigint;
  longitude: bigint;
  startDate: bigint;
  endDate: bigint;
  isActive: boolean;
  claimed: boolean;
}

const MyPolicies: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const [selectedPolicy, setSelectedPolicy] = useState<number | null>(null);

  // Get user's policy IDs
  const { data: policyIds } = useScaffoldReadContract({
    contractName: "RadiShield",
    functionName: "getPoliciesByFarmer",
    args: [connectedAddress],
  });

  // Contract interactions
  const { writeContractAsync: requestWeatherData, isPending: isRequestingWeather } = useScaffoldWriteContract("RadiShield");
  const { writeContractAsync: processWeatherData, isPending: isProcessingWeather } = useScaffoldWriteContract("RadiShield");

  // Format timestamp to readable date
  const formatDate = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleDateString();
  };

  // Format coordinates
  const formatCoordinate = (coord: bigint) => {
    return (Number(coord) / 10000).toFixed(6);
  };

  // Calculate days remaining
  const getDaysRemaining = (endDate: bigint) => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = Number(endDate) - now;
    return Math.max(0, Math.floor(remaining / (24 * 60 * 60)));
  };

  // Get policy status
  const getPolicyStatus = (policy: Policy) => {
    if (policy.claimed) return { status: "Claimed", color: "success" };
    if (!policy.isActive) return { status: "Inactive", color: "error" };
    
    const now = Math.floor(Date.now() / 1000);
    if (Number(policy.endDate) < now) return { status: "Expired", color: "warning" };
    
    return { status: "Active", color: "info" };
  };

  // Handle weather data request
  const handleRequestWeatherData = async (policyId: number) => {
    try {
      await requestWeatherData({
        functionName: "requestWeatherData",
        args: [BigInt(policyId)],
      });
      alert("Weather data requested successfully!");
    } catch (error) {
      console.error("Error requesting weather data:", error);
      alert("Error requesting weather data. Please try again.");
    }
  };

  // Handle weather data processing
  const handleProcessWeatherData = async (policyId: number) => {
    try {
      await processWeatherData({
        functionName: "processWeatherData",
        args: [BigInt(policyId)],
      });
      alert("Weather data processed successfully!");
    } catch (error) {
      console.error("Error processing weather data:", error);
      alert("Error processing weather data. Please try again.");
    }
  };

  if (!connectedAddress) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Connect Your Wallet</h1>
          <p className="text-base-content/70">Please connect your wallet to view your policies</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center mb-8">
        <Link href="/" className="btn btn-ghost btn-sm mr-4">
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </Link>
        <h1 className="text-3xl font-bold">My Insurance Policies</h1>
      </div>

      {/* Connected Address */}
      <div className="bg-base-100 p-4 rounded-lg mb-6">
        <p className="text-sm text-base-content/70 mb-2">Connected as:</p>
        <Address address={connectedAddress} />
      </div>

      {/* Policies List */}
      {!policyIds || policyIds.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🛡️</div>
          <h2 className="text-2xl font-bold mb-2">No Policies Found</h2>
          <p className="text-base-content/70 mb-6">You don't have any insurance policies yet.</p>
          <Link href="/buy-insurance" className="btn btn-primary">
            Buy Your First Policy
          </Link>
        </div>
      ) : (
        <div className="grid gap-6">
          {policyIds.map((policyId, index) => (
            <PolicyCard 
              key={index} 
              policyId={Number(policyId)} 
              onRequestWeather={handleRequestWeatherData}
              onProcessWeather={handleProcessWeatherData}
              isRequestingWeather={isRequestingWeather}
              isProcessingWeather={isProcessingWeather}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Policy Card Component
const PolicyCard = ({ 
  policyId, 
  onRequestWeather, 
  onProcessWeather,
  isRequestingWeather,
  isProcessingWeather 
}: { 
  policyId: number;
  onRequestWeather: (id: number) => void;
  onProcessWeather: (id: number) => void;
  isRequestingWeather: boolean;
  isProcessingWeather: boolean;
}) => {
  const { data: policy } = useScaffoldReadContract({
    contractName: "RadiShield",
    functionName: "getPolicy",
    args: [BigInt(policyId)],
  });

  if (!policy) {
    return (
      <div className="bg-base-100 p-6 rounded-lg shadow-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-base-300 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-base-300 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const policyData = policy as Policy;
  const status = getPolicyStatus(policyData);
  const daysRemaining = getDaysRemaining(policyData.endDate);

  return (
    <div className="bg-base-100 p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold">Policy #{policyId}</h3>
          <div className={`badge badge-${status.color} mt-2`}>
            {status.status}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">
            {formatEther(policyData.coverage)} POL
          </div>
          <div className="text-sm text-base-content/70">Coverage</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-sm text-base-content/70">Crop Type</div>
          <div className="font-medium capitalize">{policyData.cropType}</div>
        </div>
        <div>
          <div className="text-sm text-base-content/70">Premium Paid</div>
          <div className="font-medium">{formatEther(policyData.premium)} POL</div>
        </div>
        <div>
          <div className="text-sm text-base-content/70">Location</div>
          <div className="font-medium">
            {formatCoordinate(policyData.latitude)}, {formatCoordinate(policyData.longitude)}
          </div>
        </div>
        <div>
          <div className="text-sm text-base-content/70">Duration</div>
          <div className="font-medium">
            {formatDate(policyData.startDate)} - {formatDate(policyData.endDate)}
          </div>
        </div>
      </div>

      {status.status === "Active" && (
        <div className="flex items-center gap-2 mb-4">
          <ClockIcon className="h-4 w-4 text-info" />
          <span className="text-sm">
            {daysRemaining} days remaining
          </span>
        </div>
      )}

      {/* Action Buttons */}
      {status.status === "Active" && (
        <div className="flex gap-2">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onRequestWeather(policyId)}
            disabled={isRequestingWeather}
          >
            {isRequestingWeather ? "Requesting..." : "Request Weather Check"}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onProcessWeather(policyId)}
            disabled={isProcessingWeather}
          >
            {isProcessingWeather ? "Processing..." : "Process Claim"}
          </button>
        </div>
      )}

      {policyData.claimed && (
        <div className="flex items-center gap-2 text-success">
          <CheckCircleIcon className="h-5 w-5" />
          <span className="font-medium">Claim Paid</span>
        </div>
      )}
    </div>
  );
};

// Helper function to get policy status
const getPolicyStatus = (policy: Policy) => {
  if (policy.claimed) return { status: "Claimed", color: "success" };
  if (!policy.isActive) return { status: "Inactive", color: "error" };
  
  const now = Math.floor(Date.now() / 1000);
  if (Number(policy.endDate) < now) return { status: "Expired", color: "warning" };
  
  return { status: "Active", color: "info" };
};

// Helper function to get days remaining
const getDaysRemaining = (endDate: bigint) => {
  const now = Math.floor(Date.now() / 1000);
  const remaining = Number(endDate) - now;
  return Math.max(0, Math.floor(remaining / (24 * 60 * 60)));
};

// Helper function to format date
const formatDate = (timestamp: bigint) => {
  return new Date(Number(timestamp) * 1000).toLocaleDateString();
};

// Helper function to format coordinates
const formatCoordinate = (coord: bigint) => {
  return (Number(coord) / 10000).toFixed(6);
};

export default MyPolicies;