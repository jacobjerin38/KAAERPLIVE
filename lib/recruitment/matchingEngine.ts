/**
 * Deterministic Candidate-to-Job Matching Engine
 * Calculates a transparent, explainable match score (0-100%)
 * based on weighted rule evaluation without AI.
 */

export interface MatchRequirement {
  requiredSkills: string[];
  preferredSkills?: string[];
  minExperienceYears: number;
  maxExperienceYears?: number;
  educationLevel?: string;
  location?: string;
  preferredNoticeDays?: number;
}

export interface CandidateProfileForMatch {
  skills: string[];
  totalExperienceYears: number;
  highestEducation?: string;
  location?: string;
  noticePeriodDays?: number;
}

export interface MatchResult {
  score: number; // 0 to 100
  skillsScore: number; // 0 to 100
  experienceScore: number; // 0 to 100
  educationScore: number; // 0 to 100
  locationScore: number; // 0 to 100
  noticeScore: number; // 0 to 100
  reasons: {
    status: 'success' | 'warning' | 'info';
    message: string;
  }[];
}

export function computeJobMatchScore(
  candidate: CandidateProfileForMatch,
  job: MatchRequirement
): MatchResult {
  const reasons: MatchResult['reasons'] = [];

  // 1. Skills Matching (Weight: 50%)
  let skillsScore = 100;
  const candidateSkillsLower = new Set((candidate.skills || []).map(s => s.toLowerCase().trim()));
  const requiredSkills = (job.requiredSkills || []).map(s => s.trim()).filter(Boolean);

  if (requiredSkills.length > 0) {
    let matchedCount = 0;
    const missing: string[] = [];

    for (const req of requiredSkills) {
      if (candidateSkillsLower.has(req.toLowerCase())) {
        matchedCount++;
      } else {
        // Check partial word match
        const foundPartial = Array.from(candidateSkillsLower).some(cs => cs.includes(req.toLowerCase()) || req.toLowerCase().includes(cs));
        if (foundPartial) {
          matchedCount += 0.75;
        } else {
          missing.push(req);
        }
      }
    }

    skillsScore = Math.min(100, Math.round((matchedCount / requiredSkills.length) * 100));

    if (skillsScore >= 80) {
      reasons.push({
        status: 'success',
        message: `Strong Skill Fit: ${Math.round(matchedCount)}/${requiredSkills.length} required skills verified`
      });
    } else if (skillsScore >= 50) {
      reasons.push({
        status: 'warning',
        message: `Partial Skill Fit: ${Math.round(matchedCount)}/${requiredSkills.length} skills. Missing: ${missing.slice(0, 3).join(', ')}`
      });
    } else {
      reasons.push({
        status: 'warning',
        message: `Skill Gap: Missing critical skills (${missing.slice(0, 4).join(', ')})`
      });
    }
  } else {
    // If no specific required skills, assign baseline 80%
    skillsScore = candidate.skills.length > 0 ? 85 : 60;
    reasons.push({
      status: 'info',
      message: `Candidate has ${candidate.skills.length} skills listed`
    });
  }

  // 2. Experience Matching (Weight: 25%)
  let experienceScore = 100;
  const minExp = job.minExperienceYears || 0;
  const candExp = candidate.totalExperienceYears || 0;

  if (minExp > 0) {
    if (candExp >= minExp) {
      experienceScore = 100;
      reasons.push({
        status: 'success',
        message: `Experience Satisfied: ${candExp} yrs meets required ${minExp}+ yrs`
      });
    } else if (candExp >= minExp * 0.7) {
      experienceScore = Math.round((candExp / minExp) * 100);
      reasons.push({
        status: 'info',
        message: `Close Experience: ${candExp} yrs vs ${minExp} yrs required`
      });
    } else {
      experienceScore = Math.max(30, Math.round((candExp / minExp) * 100));
      reasons.push({
        status: 'warning',
        message: `Under-experienced: ${candExp} yrs vs ${minExp} yrs minimum`
      });
    }
  } else {
    experienceScore = 90;
  }

  // 3. Education Matching (Weight: 15%)
  let educationScore = 80;
  const targetEdu = (job.educationLevel || '').toLowerCase();
  const candEdu = (candidate.highestEducation || '').toLowerCase();

  if (targetEdu) {
    if (candEdu.includes(targetEdu) || (targetEdu.includes('bachelor') && candEdu.includes('bachelor'))) {
      educationScore = 100;
      reasons.push({
        status: 'success',
        message: `Education Matched: ${candidate.highestEducation}`
      });
    } else if (candEdu) {
      educationScore = 75;
      reasons.push({
        status: 'info',
        message: `Education Level: ${candidate.highestEducation}`
      });
    } else {
      educationScore = 50;
      reasons.push({
        status: 'warning',
        message: `Education details pending verification`
      });
    }
  } else {
    educationScore = candEdu ? 95 : 70;
  }

  // 4. Location Matching (Weight: 5%)
  let locationScore = 70;
  const jobLoc = (job.location || '').toLowerCase();
  const candLoc = (candidate.location || '').toLowerCase();

  if (jobLoc && candLoc) {
    if (candLoc.includes(jobLoc) || jobLoc.includes(candLoc) || (jobLoc.includes('qatar') && candLoc.includes('doha'))) {
      locationScore = 100;
      reasons.push({
        status: 'success',
        message: `Local Candidate: Residing in ${candidate.location}`
      });
    } else if (candLoc.includes('qatar') || candLoc.includes('uae') || candLoc.includes('dubai') || candLoc.includes('saudi')) {
      locationScore = 85;
      reasons.push({
        status: 'info',
        message: `GCC Candidate: Located in ${candidate.location}`
      });
    } else {
      locationScore = 60;
      reasons.push({
        status: 'info',
        message: `Overseas Candidate: Located in ${candidate.location}`
      });
    }
  } else {
    locationScore = 75;
  }

  // 5. Notice Period Matching (Weight: 5%)
  let noticeScore = 80;
  const targetNotice = job.preferredNoticeDays || 30;
  const candNotice = candidate.noticePeriodDays || 30;

  if (candNotice <= targetNotice) {
    noticeScore = 100;
    reasons.push({
      status: 'success',
      message: `Fast Joining: ${candNotice} days notice period`
    });
  } else if (candNotice <= targetNotice * 1.5) {
    noticeScore = 75;
    reasons.push({
      status: 'info',
      message: `Notice period: ${candNotice} days`
    });
  } else {
    noticeScore = 50;
    reasons.push({
      status: 'warning',
      message: `Longer Notice: ${candNotice} days (target: ${targetNotice} days)`
    });
  }

  // Calculate Weighted Total Score
  // Skills 50%, Experience 25%, Education 15%, Location 5%, Notice 5%
  const totalScore = Math.round(
    skillsScore * 0.50 +
    experienceScore * 0.25 +
    educationScore * 0.15 +
    locationScore * 0.05 +
    noticeScore * 0.05
  );

  return {
    score: Math.min(100, Math.max(0, totalScore)),
    skillsScore,
    experienceScore,
    educationScore,
    locationScore,
    noticeScore,
    reasons
  };
}
