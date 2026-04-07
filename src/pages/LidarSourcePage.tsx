/**
 * LiDAR Source Code Viewer
 * Displays the source code for the LiDAR companion service
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, Copy, Check, FileCode, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { useLocation } from 'wouter';

interface SourceFile {
  name: string;
  path: string;
  content: string;
  language: string;
}

const sourceFiles: SourceFile[] = [
  {
    name: 'Program.cs',
    path: 'lidar-service/Program.cs',
    language: 'csharp',
    content: `using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using MeasureProLidarService.Models;
using MeasureProLidarService.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<LidarCaptureService>();
builder.Services.AddSingleton<LidarMetricsService>();
builder.Services.AddHostedService<UdpReceiverService>();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();
app.UseCors();
app.UseWebSockets();

// Port auto-fallback (17777-17787)
var preferredPort = app.Configuration.GetValue<int>("LidarService:Port", 17777);
var actualPort = preferredPort;

bool TryBindPort(int port)
{
    try
    {
        using var testSocket = new TcpListener(IPAddress.Loopback, port);
        testSocket.Start();
        testSocket.Stop();
        return true;
    }
    catch (SocketException) { return false; }
}

if (!TryBindPort(preferredPort))
{
    for (int p = 17778; p <= 17787; p++)
    {
        if (TryBindPort(p)) { actualPort = p; break; }
    }
}

Console.WriteLine($"LiDAR Service starting on port {actualPort}");

// API endpoints for capture control
app.MapGet("/api/status", () => Results.Ok(new { connected = true, port = actualPort }));
app.MapPost("/api/capture/static/start", (CaptureRequest? req) => /* ... */);
app.MapPost("/api/capture/segment/start", (CaptureRequest? req) => /* ... */);
app.MapPost("/api/capture/stop", () => /* ... */);
app.MapGet("/api/captures", () => /* ... */);
app.MapPost("/api/gnss/heartbeat", (GnssHeartbeat heartbeat) => /* ... */);

// WebSocket streaming at 10Hz
app.Map("/ws", async context => { /* real-time metrics stream */ });

app.Run($"http://127.0.0.1:{actualPort}");`,
  },
  {
    name: 'appsettings.json',
    path: 'lidar-service/appsettings.json',
    language: 'json',
    content: `{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "LidarService": {
    "Port": 17777,
    "MockMode": false,
    "CapturesDirectory": "C:\\\\MeasurePRO\\\\Captures",
    "Lidar": {
      "ListenPort": 2368,
      "ExpectedIP": "192.168.1.201"
    },
    "Metrics": {
      "UpdateRateHz": 10,
      "HeightBands": [3.5, 4.0, 4.5, 5.0, 5.5, 6.0]
    },
    "Capture": {
      "StaticDefaultDurationSec": 15,
      "SegmentMaxDurationSec": 300
    }
  }
}`,
  },
  {
    name: 'MeasureProLidarService.csproj',
    path: 'lidar-service/MeasureProLidarService.csproj',
    language: 'xml',
    content: `<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <RootNamespace>MeasureProLidarService</RootNamespace>
    <AssemblyName>MeasureProLidarService</AssemblyName>
  </PropertyGroup>
</Project>`,
  },
  {
    name: 'README.md',
    path: 'lidar-service/README.md',
    language: 'markdown',
    content: `# MeasurePRO LiDAR Companion Service

Windows companion service for Hesai Pandar40P integration.

## Quick Start

1. Install .NET 8.0 SDK
2. Run: \`dotnet run\`
3. Connect from MeasurePRO at port 17777

## Features

- UDP receiver for Pandar40P packets
- Real-time metrics (road width, overhead clearance)
- WebSocket streaming at 10Hz
- Static and segment capture modes
- LAZ/LAS export for CloudCompare
- Mock mode for testing

## Configuration

Edit \`appsettings.json\` to customize:
- Port (default: 17777)
- MockMode (default: false)
- CapturesDirectory
- Height bands for clearance analysis`,
  },
];

export default function LidarSourcePage() {
  const [, setLocation] = useLocation();
  const [selectedFile, setSelectedFile] = useState<SourceFile>(sourceFiles[0]);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    /* toast removed */
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    window.location.href = '/api/downloads/lidar-service.zip';
    /* toast removed */
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation('/lidar')}
              data-testid="btn-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to LiDAR
            </Button>
            <h1 className="text-2xl font-bold">LiDAR Service Source Code</h1>
          </div>
          <Button
            onClick={handleDownload}
            className="bg-orange-600 hover:bg-orange-700"
            data-testid="btn-download-all"
          >
            <Download className="h-4 w-4 mr-2" />
            Download All Files
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="bg-gray-800 border-gray-700 lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Files
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div className="space-y-1">
                {sourceFiles.map((file) => (
                  <button
                    key={file.path}
                    onClick={() => setSelectedFile(file)}
                    className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors ${
                      selectedFile.path === file.path
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                    data-testid={`btn-file-${file.name}`}
                  >
                    <FileCode className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700 lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-white">{selectedFile.name}</CardTitle>
                <Badge variant="outline" className="text-gray-400">
                  {selectedFile.language}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                data-testid="btn-copy"
              >
                {copied ? (
                  <Check className="h-4 w-4 mr-1" />
                ) : (
                  <Copy className="h-4 w-4 mr-1" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-900 p-4 rounded overflow-x-auto text-sm text-gray-300 max-h-[600px] overflow-y-auto">
                <code>{selectedFile.content}</code>
              </pre>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gray-800 border-gray-700 mt-4">
          <CardContent className="p-4">
            <p className="text-gray-400 text-sm">
              This is a preview of the key source files. Download the complete package for all files including models, services, and interfaces.
              The service requires .NET 8.0 SDK to build and run.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
