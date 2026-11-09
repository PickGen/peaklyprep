-- PeaklyPrep: seed data --------------------------------------------------------
-- Default admin:   admin@peaklyprep.com   /   Admin12345!      (change the password after first login)

do $$
declare
  admin_id uuid := '00000000-0000-4000-8000-0000000000ad';
begin
  if not exists (select 1 from auth.users where email = 'admin@peaklyprep.com') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
      'admin@peaklyprep.com', extensions.crypt('Admin12345!', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{"full_name":"Admin"}', now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), admin_id, admin_id::text,
      jsonb_build_object('sub', admin_id::text, 'email', 'admin@peaklyprep.com', 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  -- the signup trigger created a 'student' profile; promote it
  update public.profiles set role = 'admin', full_name = 'Admin' where email = 'admin@peaklyprep.com';
end $$;

-- Demo lessons ------------------------------------------------------------------
insert into public.lessons (id, title, section, summary, content, duration_min, position) values
('a1000000-0000-4000-8000-000000000001', 'Linear Equations & Systems', 'Math',
 'Solve one- and two-variable linear equations quickly and accurately.',
 E'Linear equations show up in almost every SAT Math module. The goal is always the same: isolate the variable.\n\n## Solving one variable\n\nUndo operations in reverse order. For 3x + 7 = 31, subtract 7 to get 3x = 24, then divide by 3 so x = 8.\n\n## Systems of equations\n\nTwo strategies cover almost every question:\n\n- Substitution: replace one variable using the other equation (best when one equation already says y = …).\n- Elimination: add or subtract the equations to cancel a variable.\n\n## Check yourself\n\nAlways plug your answer back in. On the SAT, a one-second check prevents most careless errors.',
 12, 1),
('a1000000-0000-4000-8000-000000000002', 'Percentages, Ratios & Rates', 'Math',
 'Master percent change, unit rates, and proportional reasoning.',
 E'Percent problems reward a consistent method.\n\n## Percent change\n\nMultiply by (1 ± rate). A 25% markup is × 1.25, and a 20% discount is × 0.8. Successive changes multiply — they do not simply add.\n\n## Rates\n\nBuild a unit rate first (miles per hour, dollars per item), then scale it.\n\n- Distance = rate × time\n- Part = percent × whole\n\n## Watch out\n\nA 25% increase followed by a 20% decrease brings you back to the start, not to a 5% gain.',
 10, 2),
('a1000000-0000-4000-8000-000000000003', 'Quadratics & Exponential Growth', 'Math',
 'Factor quadratics and model growth that doubles over equal time steps.',
 E'## Factoring\n\nTo solve x² − 5x + 6 = 0, find two numbers that multiply to 6 and add to −5. They are −2 and −3, so (x − 2)(x − 3) = 0 and x = 2 or x = 3.\n\n## Exponential growth\n\nIf a quantity doubles every 3 hours, after 12 hours it has doubled 12 ÷ 3 = 4 times. The final amount is start × 2⁴.\n\n- Linear growth adds the same amount each step.\n- Exponential growth multiplies by the same factor each step.',
 14, 3),
('a1000000-0000-4000-8000-000000000004', 'Central Ideas & Main Purpose', 'Reading',
 'Find what a passage is really about, and why the author wrote it.',
 E'Every SAT passage has a central idea — the one claim the whole text supports.\n\n## A reliable approach\n\n- Read the first and last sentences first; they usually frame the idea.\n- Ask: if I removed this sentence, what would be lost?\n- Predict the answer before looking at the choices.\n\n## Trap answers\n\nWrong choices are usually too narrow (a single detail), too broad, or true but not what the passage argues.',
 10, 4),
('a1000000-0000-4000-8000-000000000005', 'Words in Context', 'Reading',
 'Use surrounding clues to pin down a word''s meaning in a sentence.',
 E'The SAT rarely tests obscure vocabulary. It tests whether you can use context.\n\n## Method\n\n- Cover the word and predict a replacement.\n- Look for contrast words (although, yet) and support words (because, for example).\n- Test each choice by substituting it into the sentence.\n\nExample: "Though no one objected, the council''s reaction was tepid." The word though signals contrast with open objection, so tepid means unenthusiastic.',
 8, 5),
('a1000000-0000-4000-8000-000000000006', 'Sentence Boundaries & Punctuation', 'Writing',
 'Commas, semicolons, colons and how to avoid run-ons.',
 E'Most punctuation questions come down to one test: is each side of the mark a complete sentence?\n\n## Rules that cover most questions\n\n- Two complete sentences need a period, a semicolon, or a comma plus a conjunction (and, but, so, or).\n- A comma alone cannot join two complete sentences (comma splice).\n- A colon must follow a complete sentence.\n\n## Subject–verb agreement\n\nFind the true subject and ignore interrupting phrases. In "Each of the students is required…", the subject is each, so the verb is singular.',
 12, 6)
on conflict (id) do nothing;

-- Demo tests --------------------------------------------------------------------
insert into public.tests (id, title, section, description, duration_min, position) values
('b1000000-0000-4000-8000-000000000001', 'Math Fundamentals — Set 1', 'Math', 'Algebra, percentages, quadratics and growth.', 15, 1),
('b1000000-0000-4000-8000-000000000002', 'Reading Comprehension — Set 1', 'Reading', 'Main ideas, words in context and inference.', 10, 2),
('b1000000-0000-4000-8000-000000000003', 'Writing & Language — Set 1', 'Writing', 'Grammar, punctuation and concise writing.', 10, 3)
on conflict (id) do nothing;

create or replace function public.seed_question(p_test uuid, p_pos int, p_prompt text, p_options jsonb, p_correct int, p_expl text)
returns void language plpgsql as $$
declare qid uuid;
begin
  if exists (select 1 from public.questions where test_id = p_test and prompt = p_prompt) then
    return;
  end if;
  insert into public.questions (test_id, prompt, options, position) values (p_test, p_prompt, p_options, p_pos) returning id into qid;
  insert into public.question_keys (question_id, correct_index, explanation) values (qid, p_correct, p_expl);
end $$;

-- Math
select public.seed_question('b1000000-0000-4000-8000-000000000001', 1, 'If 3x + 7 = 31, what is the value of x?', '["6","7","8","9"]', 2, '3x = 24, so x = 8.');
select public.seed_question('b1000000-0000-4000-8000-000000000001', 2, 'A $40 item is marked up 25%, then the new price is discounted 20%. What is the final price?', '["$38","$40","$42","$45"]', 1, '40 × 1.25 = 50, then 50 × 0.8 = 40.');
select public.seed_question('b1000000-0000-4000-8000-000000000001', 3, E'y = 2x + 1\n3x + y = 16\n\nWhat is the value of x in the solution to the system above?', '["2","3","4","5"]', 1, 'Substitute: 3x + 2x + 1 = 16, so 5x = 15 and x = 3.');
select public.seed_question('b1000000-0000-4000-8000-000000000001', 4, 'What are the solutions of x² − 5x + 6 = 0?', '["1 and 6","2 and 3","−2 and −3","−1 and −6"]', 1, 'x² − 5x + 6 = (x − 2)(x − 3).');
select public.seed_question('b1000000-0000-4000-8000-000000000001', 5, 'A bacteria population doubles every 3 hours. If it starts at 500, how many bacteria are there after 12 hours?', '["2,000","4,000","6,000","8,000"]', 3, '12 hours is 4 doublings: 500 × 2⁴ = 8,000.');
select public.seed_question('b1000000-0000-4000-8000-000000000001', 6, 'A car travels 150 miles in 2.5 hours. At the same rate, how many miles will it travel in 4 hours?', '["220","240","250","260"]', 1, 'Rate = 60 mph, and 60 × 4 = 240.');

-- Reading
select public.seed_question('b1000000-0000-4000-8000-000000000002', 1, E'Researchers studying urban beekeeping found that rooftop hives in dense cities produced honey with a more varied flavor than rural hives, largely because city bees forage across many kinds of ornamental plants rather than a few large crops.\n\nWhich choice best states the main idea of the text?', '["Rural bees produce less honey than city bees.","Urban bees'' diverse food sources lead to more varied honey.","Ornamental plants are harmful to bees.","Rooftop hives are easier to manage than rural ones."]', 1, 'The text ties the varied flavor directly to the variety of plants city bees visit.');
select public.seed_question('b1000000-0000-4000-8000-000000000002', 2, E'The mayor''s proposal was met with tepid enthusiasm; though no one openly objected, few council members offered the support she had hoped for.\n\nAs used in the text, "tepid" most nearly means', '["heated","unenthusiastic","hostile","confused"]', 1, 'No one objected, but support was lacking: unenthusiastic.');
select public.seed_question('b1000000-0000-4000-8000-000000000002', 3, E'Although early critics dismissed the novel as a sentimental romance, later scholars have argued that its portrayal of class tension makes it one of the era''s sharpest social commentaries.\n\nThe first part of the sentence ("Although early critics … romance") mainly serves to', '["show how the novel''s reputation changed over time","prove that the novel is a romance","criticize modern scholars","summarize the novel''s plot"]', 0, 'The contrast signals a shift from early dismissal to later appreciation.');
select public.seed_question('b1000000-0000-4000-8000-000000000002', 4, E'A museum extended its weekend hours. In the following quarter, attendance rose 18%.\n\nWhich conclusion is best supported by the information?', '["Extending hours likely contributed to higher attendance.","Weekend visitors spend more money than weekday visitors.","Weekday attendance fell during the same quarter.","The museum lowered its ticket prices."]', 0, 'Only the first choice stays within what the text supports (a likely, not certain, link).');

-- Writing
select public.seed_question('b1000000-0000-4000-8000-000000000003', 1, E'The experiment failed twice ____ the team refused to give up.\n\nWhich choice completes the text correctly?', '[", but","; but"," but",": but"]', 0, 'Two complete sentences joined by a conjunction need a comma before it.');
select public.seed_question('b1000000-0000-4000-8000-000000000003', 2, E'Each of the students ____ required to submit a project.\n\nWhich choice completes the text correctly?', '["are","is","were","have been"]', 1, 'The subject is "each," which is singular.');
select public.seed_question('b1000000-0000-4000-8000-000000000003', 3, E'The museum, which opened in 1902, ____ one of the region''s largest collections of Impressionist art.\n\nWhich choice completes the text correctly?', '["have","holding","houses","to house"]', 2, 'A finite singular verb is needed for the subject "museum."');
select public.seed_question('b1000000-0000-4000-8000-000000000003', 4, E'Which choice most effectively and concisely revises: "Due to the fact that it was raining, the game was postponed."', '["Because it was raining, the game was postponed.","Because of the reason that it was raining, the game was postponed.","Due to the fact of rain falling, the game was postponed.","As a result of the fact that rain was falling, the game was postponed."]', 0, '"Because" replaces the wordy "due to the fact that."');
select public.seed_question('b1000000-0000-4000-8000-000000000003', 5, E'The dog wagged ____ tail when its owner came home.\n\nWhich choice completes the text correctly?', '["it''s","its","its''","their"]', 1, '"Its" is the possessive; "it''s" means "it is."');

drop function public.seed_question(uuid, int, text, jsonb, int, text);
