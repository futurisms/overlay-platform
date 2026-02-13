---
name: overlay-criteria-generator
description: Generate Intelligence Template details and evaluation criteria for the Overlay Platform. Use when the user provides application questions and/or evaluator scoring guidance and needs to create overlay criteria for AI-powered document evaluation sessions. Handles two scenarios - full input (application question + evaluator guidance) or partial input (application question only, where Claude infers the evaluation criteria). Produces structured output ready to paste into the Overlay Platform's overlay creation form.
---

# Overlay Criteria Generator

Generate complete Intelligence Template details and evaluation criteria from application/assessment questions.

## What This Skill Produces

Given input about an application question (from a grant, tender, assessment, etc.), this skill generates:

1. **Intelligence Template Details** (for the overlay creation form):
   - Overlay Name
   - Description
   - Document Type
   - Document Purpose
   - When Used
   - Process Context
   - Target Audience

2. **Evaluation Criteria** (the scoring rubric for AI analysis):
   - Section to evaluate
   - What must be addressed (comprehensive checklist)
   - Critical concepts
   - Scoring rubric (Excellent → Unacceptable with specific indicators)
   - Weight and max score

## Input Scenarios

### Scenario A: Full Input (Section 1 + Section 2)
User provides:
- **Section 1:** The application question (what applicants must answer)
- **Section 2:** The evaluator guidance/scoring criteria (how assessors score it)

This is the ideal input. Claude uses both to generate precise criteria.

### Scenario B: Partial Input (Section 1 Only)
User provides:
- **Section 1:** The application question only

Claude must INFER the evaluation criteria based on:
- The question's structure and requirements
- Common evaluation patterns for this type of question
- Best practices from previous overlay criteria generation
- The implicit scoring dimensions in the question

## Processing Method

### Step 1: Analyse the Input

**Extract from Section 1 (Application Question):**
- Question number and title
- Main question being asked
- Sub-questions or bullet points (what must be addressed)
- Word limit (if specified)
- Any appendix allowances
- The domain (grant application, tender, assessment, etc.)

**Extract from Section 2 (Evaluator Guidance) — if provided:**
- Score bands (e.g., 9-10, 7-8, 5-6, 3-4, 1-2)
- Key differentiators between score bands
- Specific language used at each level (CAPITALISE these as scoring indicators)
- What makes excellent vs adequate vs weak
- Any specific requirements mentioned only in evaluator guidance

**If Section 2 is NOT provided:**
- Identify the implicit evaluation dimensions from the question
- Create a 5-band scoring rubric (Excellent, Good, Adequate, Weak, Unacceptable)
- Use the question's sub-points as the basis for scoring criteria
- Apply the principle: higher scores = more specific evidence + clearer justification + better alignment

### Step 2: Generate Intelligence Template Details

```
Overlay Name: [Question number] - [Short descriptive title]
  Example: "Question 18 - Costs and Value for Money"

Description: Evaluates [what the question assesses] based on [key dimensions].
  Covers [main topics]. Scores on a [score range] scale measuring [quality indicators].
  Example: "Evaluates project cost justification and value for money. Covers budget
  breakdown, match funding, cash flow management, subcontractor justification, and
  senior staff cost rationale. Scores 1-10 measuring evidence quality and appropriateness."

Document Type: Grant Application Response / Tender Submission / Assessment Response
  (match to the input context)

Document Purpose: To demonstrate [what the applicant needs to prove]
  Example: "To demonstrate that project costs are realistic, justified, represent
  minimum necessary funding, and deliver value for money for both the team and taxpayer."

When Used: During [stage of evaluation] for [programme/context]
  Example: "During independent expert assessment of Innovate UK grant applications"

Process Context: [What broader process this is part of]
  Example: "Innovate UK competitive grant funding assessment process. Each question
  scored independently by assessors using published criteria."

Target Audience: [Who will use this overlay]
  Example: "Assessment evaluators, grant reviewers, quality assurance reviewers"
```

### Step 3: Generate Evaluation Criteria

Structure the criteria as a single comprehensive evaluation criterion:

```
Title: [Question number] - [Topic]
Type: text

SECTION TO EVALUATE: [Question number] only (max [word limit] words [+ appendix if applicable])

WHAT MUST BE ADDRESSED:
The applicant must explain:
- [Point 1 from the question]
- [Point 2 from the question]
  - [Sub-point if nested]
  - [Sub-point if nested]
- [Point 3]
- [Continue for ALL points in the question]

CRITICAL CONCEPTS:
- [Key principle 1 that differentiates good from poor answers]
- [Key principle 2]
- [Key principle 3]
- [These are the underlying themes that assessors look for]

SCORING RUBRIC:

EXCELLENT (9-10):
- [Extract/infer highest-level descriptors]
- [Use CAPITALISED KEY PHRASES from evaluator guidance]
- [Add specific indicators of excellence for each sub-topic]
- [What would a perfect answer look like?]

GOOD (7-8):
- [Strong but not exceptional descriptors]
- [Use CAPITALISED KEY PHRASES]
- [Good evidence but may lack some detail]

ADEQUATE (5-6):
- [Acceptable but with gaps]
- [Use CAPITALISED KEY PHRASES]
- [Present but not well evidenced]

WEAK (3-4):
- [Significant concerns]
- [Use CAPITALISED KEY PHRASES]
- [Missing or unclear elements]

UNACCEPTABLE (1-2):
- [Fundamental failures]
- [Use CAPITALISED KEY PHRASES]
- [Little or no evidence]

Weight: 1 (100%)
Max Score: 1.00
```

### Step 4: Quality Checks

Before presenting output, verify:

- [ ] Every sub-question from Section 1 appears in "WHAT MUST BE ADDRESSED"
- [ ] Every scoring band from Section 2 is represented (if provided)
- [ ] Key differentiating phrases are CAPITALISED in the rubric
- [ ] The rubric degrades logically from Excellent → Unacceptable
- [ ] Critical concepts capture the underlying evaluation themes
- [ ] Intelligence Template fields are specific to this question (not generic)
- [ ] Word limit and appendix allowances are mentioned
- [ ] The criteria would allow an AI to score a response consistently

## Output Format

Present the output in two clearly separated sections:

```
═══════════════════════════════════════════════════
INTELLIGENCE TEMPLATE DETAILS
═══════════════════════════════════════════════════

Overlay Name: [value]
Description: [value]
Document Type: [value]
Document Purpose: [value]
When Used: [value]
Process Context: [value]
Target Audience: [value]

═══════════════════════════════════════════════════
EVALUATION CRITERIA
═══════════════════════════════════════════════════

Title: [value]
Type: text

[Full criteria text as structured above]

Weight: 1 (100%)
Max Score: 1.00
```

## Scoring Rubric Generation Rules

### When Section 2 IS Provided
1. Use the EXACT score bands from the evaluator guidance
2. Extract key phrases and CAPITALISE them as indicators
3. Ensure every point mentioned in ANY band is traceable to a sub-question
4. Add specific measurable indicators where the guidance is vague
5. Maintain the evaluator's language and intent

### When Section 2 is NOT Provided (Inference Mode)
1. Create a 5-band rubric: Excellent (9-10), Good (7-8), Adequate (5-6), Weak (3-4), Unacceptable (1-2)
2. Use this degradation pattern for each sub-topic:
   - Excellent: CLEARLY demonstrated with STRONG, DETAILED evidence
   - Good: Demonstrated with GOOD evidence
   - Adequate: SOME evidence but LACKS DETAIL
   - Weak: LIMITED or UNCLEAR evidence
   - Unacceptable: LITTLE OR NO evidence
3. For each sub-question, describe what each score band looks like
4. Add domain-appropriate critical concepts
5. Flag to the user that criteria were INFERRED and should be reviewed

### Capitalisation Rules for Scoring Indicators
These words should be CAPITALISED when they appear as scoring differentiators:
- Strength indicators: CLEARLY, STRONG, DETAILED, COMPREHENSIVE, WELL, FULLY, EXCELLENT
- Adequacy indicators: GOOD, APPROPRIATE, REASONABLE, SUFFICIENT
- Weakness indicators: SOME, BROADLY, LIMITED, LACKS, NOT WELL
- Failure indicators: LITTLE, NO, NOT, UNCLEAR, UNREALISTIC, POORLY

## Multiple Questions in One Session

When creating an overlay for a session with multiple questions:
- Each question becomes a separate evaluation criterion
- Weight each criterion appropriately (equal weight unless specified)
- Adjust Max Score to reflect relative importance
- Keep Intelligence Template details at the session level (covering all questions)

Example for 3 questions:
```
Criterion 1: Question 15 - Innovation
Weight: 0.33 (33%)
Max Score: 0.33

Criterion 2: Question 16 - Market Opportunity  
Weight: 0.33 (33%)
Max Score: 0.33

Criterion 3: Question 18 - Costs and Value for Money
Weight: 0.34 (34%)
Max Score: 0.34
```

## Example: Full Input → Full Output

### Input
**Section 1 (Application Question):**
> Question 18. Costs and value for money
> How much will the project cost and how does it represent value for money?
> Explain: total eligible costs by partner, grant requested, how partners finance contributions,
> value for money for team and taxpayer, comparison to alternative spending, subcontractor costs,
> senior staff justification. Max 400 words.

**Section 2 (Evaluator Guidance):**
> 9-10: Clearly set out with very strong evidence realistic costs... minimum necessary... clear value for money...
> 7-8: Good supporting evidence... appropriate costs... value for money clear...
> 5-6: Broadly appropriate but lack detail... some concerns... not fully assured...
> 3-4: Unrealistic... poorly defined... no justification for subcontracting...
> 1-2: Little or no evidence... not appropriate or justified...

### Output
[See the example document "Criteria_question_18.docx" for the complete generated output]

## Example: Partial Input → Inferred Output

### Input
**Section 1 Only:**
> Question 5. Technical Approach
> Describe your technical approach to delivering the project objectives.
> Explain: methodology, key technologies, technical risks and mitigations,
> scalability considerations. Max 500 words.

### Output (Inferred)
Claude generates the full Intelligence Template + Evaluation Criteria using inference rules,
and flags: "⚠️ Evaluation criteria were INFERRED from the application question only.
No evaluator guidance was provided. Please review and adjust the scoring rubric."

## When to Use This Skill

- User says "create overlay criteria" or "generate evaluation criteria"
- User provides an application question and asks for overlay/template details
- User references "Section 1" and/or "Section 2" format
- User needs to set up a new evaluation session in the Overlay Platform
- User provides a grant question, tender question, or assessment question
- User asks to "do the same as we did for Question 18" or similar reference

## Prompt Template

When the user provides input, use this internal processing flow:

```
1. Identify: Is this Section 1 + Section 2, or Section 1 only?
2. Extract: Pull out question number, title, sub-questions, word limit, score bands
3. Generate: Intelligence Template Details (7 fields)
4. Generate: Evaluation Criteria (structured rubric)
5. Verify: Quality checks (all sub-questions covered, rubric degrades logically)
6. Present: Two-section formatted output
7. Flag: If inferred, note that criteria should be reviewed
```

---

**Remember:** The quality of the evaluation criteria directly determines how well the AI scores documents. Be exhaustive in "WHAT MUST BE ADDRESSED" — every sub-point the applicant should cover must be listed. Be precise in the scoring rubric — the AI needs clear differentiators between score bands.
