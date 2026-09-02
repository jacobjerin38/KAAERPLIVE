/**
 * Deterministic Non-AI Resume Parser
 * Extracts structured candidate profile data using rule-based algorithms,
 * regex patterns, section chunking, and dictionary matching.
 * Zero external AI / API calls required.
 */

export interface ParsedResume {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  portfolioUrl: string;
  currentTitle: string;
  currentCompany: string;
  totalExperienceYears: number;
  highestEducation: string;
  educationDegree: string;
  educationInstitution: string;
  skills: string[];
  workExperience: {
    title: string;
    company: string;
    startDate?: string;
    endDate?: string;
    durationYears?: number;
  }[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NOT_DETECTED';
  rawText: string;
}

// Standard Skills Dictionary for deterministic keyword matching
const DEFAULT_SKILLS_DICTIONARY: Record<string, string[]> = {
  'AutoCAD': ['autocad', 'cad', 'autocad 2d', 'autocad 3d'],
  'Revit': ['revit', 'autodesk revit', 'bim revit', 'bim'],
  'Electrical Design': ['electrical design', 'low voltage', 'power distribution', 'substation', 'switchgear'],
  'HVAC': ['hvac', 'chilled water', 'air conditioning', 'ventilation', 'ductwork', 'ahu', 'fcu'],
  'Plumbing & Drainage': ['plumbing', 'drainage', 'water supply', 'sanitary'],
  'Project Management': ['project management', 'pmp', 'project planning', 'primavera', 'p6', 'ms project', 'agile'],
  'Site Supervision': ['site supervision', 'site engineer', 'field engineer', 'qa/qc', 'quality control'],
  'Safety (NEBOSH/OSHA)': ['nebosh', 'osha', 'hse', 'safety officer', 'ehs', 'safety management'],
  'Civil Engineering': ['civil engineering', 'structural engineering', 'concrete', 'steel structure'],
  'Mechanical Engineering': ['mechanical engineering', 'rotating equipment', 'piping', 'welding'],
  'Microsoft Excel': ['excel', 'ms excel', 'advanced excel', 'vlookup', 'pivot tables', 'spreadsheets'],
  'Accounting': ['accounting', 'bookkeeping', 'ifrs', 'vat', 'tally', 'general ledger', 'accounts payable', 'accounts receivable'],
  'Procurement': ['procurement', 'purchasing', 'vendor management', 'supply chain', 'sourcing', 'rfq'],
  'React': ['react', 'react.js', 'reactjs', 'react native'],
  'TypeScript': ['typescript', 'ts'],
  'JavaScript': ['javascript', 'js', 'es6'],
  'Node.js': ['node.js', 'nodejs', 'express'],
  'Python': ['python', 'django', 'fastapi'],
  'SQL': ['sql', 'postgresql', 'postgres', 'mysql', 'oracle', 'database'],
  'ERP Systems': ['erp', 'sap', 'oracle erp', 'dynamics', 'odoo'],
  'Sales & Business Development': ['sales', 'business development', 'client acquisition', 'negotiation', 'crm']
};

const GCC_LOCATIONS = [
  'Doha', 'Qatar', 'Al Rayyan', 'Al Wakrah', 'Lusail',
  'Dubai', 'Abu Dhabi', 'Sharjah', 'UAE', 'United Arab Emirates',
  'Riyadh', 'Jeddah', 'Dammam', 'Saudi Arabia', 'KSA',
  'Manama', 'Bahrain',
  'Muscat', 'Oman',
  'Kuwait City', 'Kuwait',
  'Cairo', 'Egypt',
  'Manila', 'Philippines',
  'Mumbai', 'Delhi', 'Bangalore', 'Kerala', 'India'
];

const DEGREE_PATTERNS = [
  { level: 'Doctorate / PhD', regex: /\b(ph\.?d|doctorate|doctor of philosophy)\b/i },
  { level: 'Master Degree', regex: /\b(m\.?tech|m\.?e\.?|master of technology|m\.?s\.?|master of science|m\.?b\.?a\.?|master of business administration|m\.?com|m\.?a\.?)\b/i },
  { level: 'Bachelor Degree', regex: /\b(b\.?tech|b\.?e\.?|bachelor of technology|bachelor of engineering|b\.?s\.?|b\.?sc|bachelor of science|b\.?com|b\.?a\.?|b\.?arch)\b/i },
  { level: 'Diploma', regex: /\b(diploma|polytechnic|associate degree)\b/i },
  { level: 'High School', regex: /\b(high school|secondary school|hsc|sslc|12th)\b/i }
];

/**
 * Parses raw resume text into a structured candidate profile
 */
export function parseResumeText(rawText: string, customSkillsDictionary?: Record<string, string[]>): ParsedResume {
  if (!rawText || rawText.trim().length < 20) {
    return {
      firstName: 'Applicant',
      lastName: '',
      email: '',
      phone: '',
      location: '',
      linkedinUrl: '',
      portfolioUrl: '',
      currentTitle: '',
      currentCompany: '',
      totalExperienceYears: 0,
      highestEducation: '',
      educationDegree: '',
      educationInstitution: '',
      skills: [],
      workExperience: [],
      confidence: 'NOT_DETECTED',
      rawText: rawText || ''
    };
  }

  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const normalizedText = rawText.replace(/\s+/g, ' ');

  // 1. Extract Email
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
  const emailMatch = rawText.match(emailRegex);
  const email = emailMatch ? emailMatch[1].toLowerCase().trim() : '';

  // 2. Extract Phone Number (International / GCC formats)
  const phoneRegex = /(?:\+?(\d{1,3}))?[-. (]*(\d{3,4})[-. )]*(\d{3,4})[-. ]*(\d{3,4})/g;
  let phone = '';
  let pMatch: RegExpExecArray | null;
  while ((pMatch = phoneRegex.exec(rawText)) !== null) {
    const candidate = pMatch[0].trim();
    // Verify phone candidate has at least 8 digits and doesn't look like a year range
    const digitsOnly = candidate.replace(/\D/g, '');
    if (digitsOnly.length >= 8 && digitsOnly.length <= 15 && !candidate.includes('- 20') && !candidate.includes(' - 19')) {
      phone = candidate;
      break;
    }
  }

  // 3. Extract Links
  const linkedinMatch = rawText.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);
  const linkedinUrl = linkedinMatch ? `https://linkedin.com/in/${linkedinMatch[1]}` : '';

  const githubMatch = rawText.match(/github\.com\/([a-zA-Z0-9_-]+)/i);
  const portfolioUrl = githubMatch ? `https://github.com/${githubMatch[1]}` : '';

  // 4. Extract Name (from top 5 lines)
  let firstName = '';
  let lastName = '';
  const ignorableHeaderRegex = /^(curriculum vitae|resume|cv|biodata|bio data|personal profile|profile|contact info|contact details)/i;

  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i];
    if (
      line.length > 2 &&
      line.length < 50 &&
      !ignorableHeaderRegex.test(line) &&
      !line.includes('@') &&
      !/\d{4}/.test(line) &&
      !line.includes('http')
    ) {
      // Line looks like a personal name
      const nameParts = line.replace(/[^\w\s]/g, '').trim().split(/\s+/);
      if (nameParts.length >= 1 && nameParts.length <= 4) {
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(' ');
        break;
      }
    }
  }

  // Fallback name if header did not catch it
  if (!firstName && email) {
    const emailUser = email.split('@')[0].replace(/[._-]/g, ' ');
    const parts = emailUser.split(' ');
    firstName = capitalize(parts[0]);
    if (parts.length > 1) lastName = capitalize(parts[1]);
  }

  // 5. Extract Location
  let location = '';
  for (const loc of GCC_LOCATIONS) {
    const locRegex = new RegExp(`\\b${loc}\\b`, 'i');
    if (locRegex.test(rawText)) {
      location = loc;
      // If found specific city, try to pair with country if present
      if (loc === 'Doha' && /\bQatar\b/i.test(rawText)) location = 'Doha, Qatar';
      if (loc === 'Dubai' && /\bUAE\b/i.test(rawText)) location = 'Dubai, UAE';
      if (loc === 'Riyadh' && /\bSaudi\b/i.test(rawText)) location = 'Riyadh, Saudi Arabia';
      break;
    }
  }

  // 6. Extract Education
  let highestEducation = '';
  let educationDegree = '';
  let educationInstitution = '';

  for (const d of DEGREE_PATTERNS) {
    const match = rawText.match(d.regex);
    if (match) {
      highestEducation = d.level;
      educationDegree = match[0].toUpperCase();
      break;
    }
  }

  // Detect institution (search near University, College, Institute, Polytechnic)
  const instMatch = rawText.match(/\b([A-Z][a-zA-Z\s&]{3,40}(?:University|College|Institute|Polytechnic|School))\b/);
  if (instMatch) {
    educationInstitution = instMatch[1].trim();
  }

  // 7. Extract Experience Duration (Years)
  let totalExperienceYears = 0;

  // Direct statement check: "5+ years of experience"
  const expStatementMatch = rawText.match(/(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)\s+(?:of\s+)?experience/i);
  if (expStatementMatch) {
    totalExperienceYears = parseFloat(expStatementMatch[1]);
  } else {
    // Calculate from year ranges (e.g. 2018 - 2024, 2020 to Present)
    const currentYear = new Date().getFullYear();
    const yearRangeRegex = /\b(19\d\d|20\d\d)\s*(?:-|–|to)\s*(19\d\d|20\d\d|present|current|now)\b/gi;
    let yMatch: RegExpExecArray | null;
    let minYear = currentYear;
    let maxYear = 1970;
    let foundRanges = 0;

    while ((yMatch = yearRangeRegex.exec(rawText)) !== null) {
      const startY = parseInt(yMatch[1], 10);
      const endYStr = yMatch[2].toLowerCase();
      const endY = (endYStr === 'present' || endYStr === 'current' || endYStr === 'now') ? currentYear : parseInt(endYStr, 10);

      if (startY >= 1970 && startY <= currentYear && endY >= startY) {
        minYear = Math.min(minYear, startY);
        maxYear = Math.max(maxYear, endY);
        foundRanges++;
      }
    }

    if (foundRanges > 0 && maxYear >= minYear) {
      totalExperienceYears = Math.min(maxYear - minYear, 40);
    }
  }

  // 8. Extract Skills
  const dictionary = { ...DEFAULT_SKILLS_DICTIONARY, ...(customSkillsDictionary || {}) };
  const detectedSkills: Set<string> = new Set();

  for (const [canonicalSkill, aliases] of Object.entries(dictionary)) {
    for (const alias of aliases) {
      // Word boundary regex for clean matching
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const skillRegex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (skillRegex.test(rawText)) {
        detectedSkills.add(canonicalSkill);
        break;
      }
    }
  }

  // 9. Extract Current Title & Company (Heuristics)
  let currentTitle = '';
  let currentCompany = '';
  const titlePatterns = [
    /\b(Senior|Lead|Junior|Chief|Principal)?\s*(Electrical Engineer|Mechanical Engineer|Civil Engineer|Site Engineer|Project Manager|Software Engineer|Developer|Accountant|QA\/QC Engineer|HSE Officer|Safety Officer|Procurement Specialist|Estimator|Architect|Draftsman)\b/i,
    /\b(Manager|Director|Engineer|Executive|Officer|Supervisor|Coordinator|Consultant|Analyst|Designer)\b/i
  ];

  for (const tp of titlePatterns) {
    const tMatch = rawText.match(tp);
    if (tMatch) {
      currentTitle = tMatch[0].trim();
      break;
    }
  }

  // Determine Parser Confidence
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NOT_DETECTED' = 'LOW';
  const hasEmail = Boolean(email);
  const hasPhone = Boolean(phone);
  const hasSkills = detectedSkills.size >= 2;
  const hasName = Boolean(firstName);

  if (hasEmail && hasPhone && hasName && hasSkills) {
    confidence = 'HIGH';
  } else if (hasEmail && (hasPhone || hasSkills || hasName)) {
    confidence = 'MEDIUM';
  } else if (rawText.length > 50) {
    confidence = 'LOW';
  } else {
    confidence = 'NOT_DETECTED';
  }

  return {
    firstName: firstName || 'Applicant',
    lastName: lastName || '',
    email,
    phone,
    location,
    linkedinUrl,
    portfolioUrl,
    currentTitle,
    currentCompany,
    totalExperienceYears: Math.round(totalExperienceYears * 10) / 10,
    highestEducation,
    educationDegree,
    educationInstitution,
    skills: Array.from(detectedSkills),
    workExperience: currentTitle ? [{ title: currentTitle, company: currentCompany || 'Previous Employer' }] : [],
    confidence,
    rawText
  };
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
