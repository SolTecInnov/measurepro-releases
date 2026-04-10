/**
 * RoadScope Collaborate Dialog
 *
 * Generates a pairing code (RS-XXXXXX) for an existing local survey via the new
 * RoadScope collaborative endpoints, and lets the user invite collaborators by
 * email + role.
 *
 * Wired to:
 *   POST /api/roadscope/proxy/surveys/prepare       → pairing code + roadscope surveyId
 *   POST /api/roadscope/proxy/surveys/:id/collaborators → add collaborator by email + role
 *
 * NOTE: This dialog only handles the HOST side of pairing. The JOIN side
 * (entering a code on a second device) is intentionally out of scope here —
 * codes are shared verbally / via text and entered on the other device's UI.
 */

import { useState } from 'react';
import { API_BASE_URL } from '@/lib/config/environment';
import { useAuth } from '../../lib/auth/AuthContext';
import { getRoadScopeClient } from '../../lib/roadscope/client';
import type { Survey } from '../../lib/survey/types';
import type {
  CollaboratorRole,
  PrepareSurveyResponse,
  RoadScopeCollaborator,
} from '../../lib/roadscope/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  X,
  Users,
  Copy,
  Check,
  Loader2,
  KeyRound,
  UserPlus,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface RoadScopeCollaborateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  survey: Survey;
}

const ROLE_OPTIONS: Array<{ value: CollaboratorRole; label: string; help: string }> = [
  { value: 'viewer', label: 'Viewer', help: 'Can view the survey but not modify it' },
  { value: 'editor', label: 'Editor', help: 'Can add and edit POIs and routes' },
  { value: 'owner', label: 'Owner', help: 'Full control including managing collaborators' },
];

function formatExpiresAt(iso: string): string {
  try {
    const date = new Date(iso);
    const now = Date.now();
    const diffMs = date.getTime() - now;
    if (diffMs <= 0) return 'expired';
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days >= 1) return `expires in ${days}d ${hours}h`;
    return `expires in ${hours}h`;
  } catch {
    return iso;
  }
}

async function loadApiKey(userId: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/roadscope/settings/${userId}/key`);
    const json = await res.json();
    if (json.success && json.apiKey) return json.apiKey as string;
    return null;
  } catch {
    return null;
  }
}

export function RoadScopeCollaborateDialog({
  isOpen,
  onClose,
  survey,
}: RoadScopeCollaborateDialogProps) {
  const { user } = useAuth();
  const userId = user?.uid || localStorage.getItem('current_user_id') || '';

  const [pairing, setPairing] = useState<PrepareSurveyResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const [collaboratorEmail, setCollaboratorEmail] = useState('');
  const [collaboratorRole, setCollaboratorRole] = useState<CollaboratorRole>('viewer');
  const [collaborators, setCollaborators] = useState<RoadScopeCollaborator[]>([]);
  const [addingCollaborator, setAddingCollaborator] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setPairing(null);
    setCopied(false);
    setCollaboratorEmail('');
    setCollaboratorRole('viewer');
    setCollaborators([]);
    setError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleGenerate = async () => {
    setError(null);
    if (!userId) {
      setError('You must be signed in to generate a pairing code.');
      return;
    }

    setGenerating(true);
    try {
      const apiKey = await loadApiKey(userId);
      if (!apiKey) {
        setError('RoadScope API key not configured. Open Settings → RoadScope first.');
        setGenerating(false);
        return;
      }

      const client = getRoadScopeClient();
      client.setApiKey(apiKey);

      const surveyName = survey.surveyTitle || 'Untitled survey';
      const result = await client.prepareSurvey({
        name: surveyName,
        description: `Collaborative session for ${surveyName}`,
        externalId: survey.id,
      });

      if (!result.success || !result.data) {
        setError(result.error || 'Failed to generate pairing code');
        setGenerating(false);
        return;
      }

      setPairing(result.data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCode = async () => {
    if (!pairing) return;
    try {
      await navigator.clipboard.writeText(pairing.pairingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const handleAddCollaborator = async () => {
    setError(null);
    if (!pairing) {
      setError('Generate a pairing code first.');
      return;
    }
    const email = collaboratorEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (collaborators.some(c => c.email.toLowerCase() === email.toLowerCase())) {
      setError(`${email} is already a collaborator.`);
      return;
    }

    setAddingCollaborator(true);
    try {
      const client = getRoadScopeClient();
      const result = await client.addCollaborator(pairing.surveyId, {
        email,
        role: collaboratorRole,
      });

      if (!result.success || !result.data) {
        setError(result.error || 'Failed to add collaborator');
        setAddingCollaborator(false);
        return;
      }

      setCollaborators(prev => [
        ...prev,
        {
          email: result.data!.email,
          role: result.data!.role,
          addedAt: result.data!.addedAt,
        },
      ]);
      setCollaboratorEmail('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setAddingCollaborator(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl bg-gray-800 border-gray-700 max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-400" />
              <div>
                <CardTitle className="text-white">Share & Collaborate</CardTitle>
                <CardDescription className="text-gray-400">
                  {survey.surveyTitle || 'Untitled survey'}
                </CardDescription>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-200 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Pairing code section */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
                Pairing code
              </h3>
            </div>

            {!pairing ? (
              <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
                <p className="text-sm text-gray-400 mb-3">
                  Generate a pairing code to share this survey with another MeasurePRO
                  user or RoadScope client. The code is valid for 7 days.
                </p>
                <Button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="bg-blue-600 hover:bg-blue-500 text-white"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4 mr-2" />
                      Generate pairing code
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-blue-700/50 bg-blue-900/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-2xl font-bold text-blue-200 tracking-wider">
                      {pairing.pairingCode}
                    </div>
                    <div className="text-xs text-blue-300/70 mt-1">
                      {formatExpiresAt(pairing.expiresAt)}
                    </div>
                  </div>
                  <Button
                    onClick={handleCopyCode}
                    variant="outline"
                    size="sm"
                    className="border-blue-700/50 text-blue-200 hover:bg-blue-800/40"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Share this code with collaborators. They can paste it on their device
                  to join the survey.
                </p>
              </div>
            )}
          </section>

          {/* Collaborators section — only enabled after a pairing code exists */}
          <section className={pairing ? '' : 'opacity-50 pointer-events-none'}>
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
                Invite collaborator by email
              </h3>
            </div>

            <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4 space-y-3">
              <input
                type="email"
                placeholder="collaborator@example.com"
                value={collaboratorEmail}
                onChange={e => setCollaboratorEmail(e.target.value)}
                disabled={!pairing || addingCollaborator}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
              />

              <div>
                <label className="block text-xs text-gray-400 mb-1">Role</label>
                <select
                  value={collaboratorRole}
                  onChange={e => setCollaboratorRole(e.target.value as CollaboratorRole)}
                  disabled={!pairing || addingCollaborator}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {ROLE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} — {opt.help}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                onClick={handleAddCollaborator}
                disabled={!pairing || addingCollaborator || !collaboratorEmail.trim()}
                className="bg-blue-600 hover:bg-blue-500 text-white w-full"
              >
                {addingCollaborator ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding…
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add collaborator
                  </>
                )}
              </Button>

              {collaborators.length > 0 && (
                <div className="pt-2 border-t border-gray-700">
                  <div className="text-xs text-gray-400 mb-2">
                    Added this session ({collaborators.length})
                  </div>
                  <ul className="space-y-1">
                    {collaborators.map(c => (
                      <li
                        key={c.email}
                        className="flex items-center justify-between text-sm text-gray-200"
                      >
                        <span className="truncate">{c.email}</span>
                        <span className="text-xs uppercase tracking-wide text-blue-300">
                          {c.role}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleClose}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
