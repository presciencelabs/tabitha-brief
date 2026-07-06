import { TemplateHandler } from 'easy-template-x'
import { GoogleGenAI } from '@google/genai'

// set to true to use hardcoded content instead of hitting web services (for development)
const offline = !false

// http utilities

function validateHttpResponse(response: Response) {
	if (!response.ok)
		throw new Error(`HTTP error: received response of status ${response.status} (${response.statusText}) from ${response.url}`)
}

// ai utilities

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY_GEMINI })

async function askLlm(prompt: string, systemPrompt: string = '', responseJsonSchema = {}): Promise<string> {
	const response = await ai.models.generateContent({
		model: 'gemini-3.5-flash',
		contents: prompt,
		config: {
			temperature: 0.0,
			seed: 41,
			frequencyPenalty: 0.0,
			presencePenalty: 0.0,
			systemInstruction: systemPrompt,
			responseMimeType: 'application/json',
			responseJsonSchema,
		}
	})
	return response.text
}

const translationOpener = '[['
const translationDelimiter = '||'
const translationCloser = ']]'
const placeholderOpener = '{{'
const placeholderCloser = '}}'

function markForTranslation(text: string, targetLanguageName: string = input.lwcName, sourceLanguageName: string = 'English'): string {
	return sourceLanguageName != targetLanguageName ? `${translationOpener}${text}${translationDelimiter}${sourceLanguageName}${translationDelimiter}${targetLanguageName}${translationCloser}` : text
}

async function translateJson(json: any): Promise<any> {
	if (offline)
		return json
	let prompt = []
	let text = JSON.stringify(json)
	while (true) {
		const openerIndex = text.indexOf(translationOpener)
		if (openerIndex == -1)
			break
		const closerIndex = text.indexOf(translationCloser, openerIndex + translationOpener.length)
		const parts = text.substring(openerIndex + translationOpener.length, closerIndex).split(translationDelimiter)
		text = text.substring(0, openerIndex) + placeholderOpener + prompt.length + placeholderCloser + text.substring(closerIndex + translationCloser.length, text.length)
		prompt.push({ text: parts[0], sourceLanguage: parts[1], targetLanguage: parts[2] })
	}
	const systemPrompt = await Bun.file('prompts/translate-system.txt').text()
	const responseJsonSchema = {
		type: 'array',
		items: {
			type: 'string',
		}
	}
	const substitutions = JSON.parse(await askLlm(JSON.stringify(prompt), systemPrompt, responseJsonSchema))
	for (let i = 0; i < substitutions.length; ++i)
		text = text.replace(`${placeholderOpener}${i}${placeholderCloser}`, substitutions[i].replaceAll('\"', '\\\"'))
	return JSON.parse(text)
}

// aquifer utilities

async function aquiferFetch(apiPath: string, queryParams: URLSearchParams): Promise<any> {
	return fetch(`https://api.aquifer.bible${apiPath}?${queryParams.toString()}`, {
		headers: {
			"api-key": process.env.API_KEY_AQUIFER,
		},
	})
}

async function getAquiferContentIds(params): Promise<number[]> {
	const queryParams = new URLSearchParams({
		languageCode: 'eng',
		resourceCollectionCode: 'SILOpenTranslatorsNotes',
		bookCode: usfmBookCodeByBookName.filter(x => x.key == params.bookName)[0].value,
		startChapter: params.chapterNo,
		endChapter: params.chapterNo,
		startVerse: params.verseNo,
		endVerse: params.verseNo
	})
	const response = await aquiferFetch('/resources/search', queryParams)
	validateHttpResponse(response)
	return (await response.json()).items.map(({id}) => id)
}

// usfm utilities

const usfmBookCodeByBookName = [
	{ key: 'Genesis', value: 'GEN' },
	{ key: 'Exodus', value: 'EXO' },
	{ key: 'Leviticus', value: 'LEV' },
	{ key: 'Numbers', value: 'NUM' },
	{ key: 'Deuteronomy', value: 'DEU' },
	{ key: 'Joshua', value: 'JOS' },
	{ key: 'Judges', value: 'JDG' },
	{ key: 'Ruth', value: 'RUT' },
	{ key: '1 Samuel', value: '1SA' },
	{ key: '2 Samuel', value: '2SA' },
	{ key: '1 Kings', value: '1KI' },
	{ key: '2 Kings', value: '2KI' },
	{ key: '1 Chronicles', value: '1CH' },
	{ key: '2 Chronicles', value: '2CH' },
	{ key: 'Ezra', value: 'EZR' },
	{ key: 'Nehemiah', value: 'NEH' },
	{ key: 'Esther', value: 'EST' },
	{ key: 'Job', value: 'JOB' },
	{ key: 'Psalms', value: 'PSA' },
	{ key: 'Proverbs', value: 'PRO' },
	{ key: 'Ecclesiastes', value: 'ECC' },
	{ key: 'Song of Songs', value: 'SNG' },
	{ key: 'Isaiah', value: 'ISA' },
	{ key: 'Jeremiah', value: 'JER' },
	{ key: 'Lamentations', value: 'LAM' },
	{ key: 'Ezekiel', value: 'EZK' },
	{ key: 'Daniel', value: 'DAN' },
	{ key: 'Hosea', value: 'HOS' },
	{ key: 'Joel', value: 'JOL' },
	{ key: 'Amos', value: 'AMO' },
	{ key: 'Obadiah', value: 'OBA' },
	{ key: 'Jonah', value: 'JON' },
	{ key: 'Micah', value: 'MIC' },
	{ key: 'Nahum', value: 'NAM' },
	{ key: 'Habakkuk', value: 'HAB' },
	{ key: 'Zephaniah', value: 'ZEP' },
	{ key: 'Haggai', value: 'HAG' },
	{ key: 'Zechariah', value: 'ZEC' },
	{ key: 'Malachi', value: 'MAL' },

	{ key: 'Matthew', value: 'MAT' },
	{ key: 'Mark', value: 'MRK' },
	{ key: 'Luke', value: 'LUK' },
	{ key: 'John', value: 'JHN' },
	{ key: 'Acts', value: 'ACT' },
	{ key: 'Romans', value: 'ROM' },
	{ key: '1 Corinthians', value: '1CO' },
	{ key: '2 Corinthians', value: '2CO' },
	{ key: 'Galatians', value: 'GAL' },
	{ key: 'Ephesians', value: 'EPH' },
	{ key: 'Philippians', value: 'PHP' },
	{ key: 'Colossians', value: 'COL' },
	{ key: '1 Thessalonians', value: '1TH' },
	{ key: '2 Thessalonians', value: '2TH' },
	{ key: '1 Timothy', value: '1TI' },
	{ key: '2 Timothy', value: '2TI' },
	{ key: 'Titus', value: 'TIT' },
	{ key: 'Philemon', value: 'PHM' },
	{ key: 'Hebrews', value: 'HEB' },
	{ key: 'James', value: 'JAS' },
	{ key: '1 Peter', value: '1PE' },
	{ key: '2 Peter', value: '2PE' },
	{ key: '1 John', value: '1JN' },
	{ key: '2 John', value: '2JN' },
	{ key: '3 John', value: '3JN' },
	{ key: 'Jude', value: 'JUD' },
	{ key: 'Revelation', value: 'REV' }
]

// content access

function getNumVersesInChapter(bookName: string, chapterNo: number): number {
	return [
		{ name: 'Titus', versesInChapter: [16, 15, 15] }
	].filter(book => book.name == bookName)[0].versesInChapter[chapterNo - 1]
}

async function getCopilotBasedInfo(params): Promise<any> {
	if (offline)
		return { "verse": { "book": "Titus", "chapter": 2, "verse": 14 }, "english_text": "(Literal) Jesus Christ gave himself for us to redeem us from the power of all evil actions and cause us to become pure for him. (Dynamic) Jesus Christ died for us to redeem us from the power of all evil actions and cause us to become pure for him. (End of Alternates) He did this so that we would belong to him and we would eagerly desire to do good things.", "lwc_text": "(Terjemahan Harafiah) Yesus Kristus memberi diri-Nya sendiri untuk kita untuk menebus kita dari kuasa semua tindakan jahat dan untuk menjadikan kita murni untuk-Nya. (Terjemahan Dinamis) Yesus Kristus mati untuk kita untuk menebus kita dari kuasa semua tindakan jahat dan untuk menjadikan kita murni untuk-Nya. (Akhir Alternatif) Dia melakukan hal ini supaya kita menjadi milik-Nya dan supaya kita ingin dengan semangat melakukan hal-hal yang baik.", "notes": [{ "meaning": "Kata \"kita\" dalam bagian ini merujuk kepada penulis dan juga menyertakan para pembaca atau pendengar.", "check": "Pertimbangkan apakah kata ganti yang Anda gunakan dalam terjemahan menyertakan pembaca sebagai bagian dari kelompok tersebut.", "trigger": { "name": "Noun Person", "node_id": "0.3.0", "flags": [{ "name": "Noun Person", "value": "First Inclusive", "encoding_anchor": { "node_id": "0.3.0", "category": "Noun", "concept": "Paul-A", "person": "First Inclusive", "noun_index": "3" }, "weight": 3 }], "weight": 3, "prompt": "First Inclusive means that the reader/listener is included when the writer/speaker says \"we/us\".\n\t\t\t\t\tDO NOT say \"if your language has an inclusive/exclusive distinction\"." } }, { "meaning": "Yesus memberikan diri-Nya sendiri dengan maksud atau tujuan untuk menebus kita.", "check": "Pertimbangkan apakah hubungan tujuan antara tindakan memberikan diri dan penebusan ini diungkapkan dengan tepat dalam terjemahan Anda.", "trigger": { "name": "Intent/Result", "node_id": "0.4.0", "flags": [{ "name": "Intent/Result", "value": "Intent", "encoding_anchor": { "node_id": "0.4.0", "category": "Adposition", "event": "give-C", "result": "save-A" }, "weight": 4 }], "weight": 4 } }, { "meaning": "Teks asli sebenarnya hanya menyebutkan \"tindakan jahat\", tetapi hal ini dapat dipahami sebagai \"kuasa tindakan jahat\".", "check": "Pertimbangkan cara mana yang lebih jelas dalam bahasa Anda.", "trigger": { "name": "Metonymy", "node_id": "0.4.4.3", "flags": [{ "name": "Metonymy", "value": "power-A of action-A", "encoding_anchor": { "node_id": "0.4.4.3", "category": "Noun Phrase", "whole": "action-A", "part": "power-A", "metonymy_type": "Dynamic Expansion (Metonymy)" }, "weight": 5 }], "weight": 5, "prompt": "For the meaning, explain that the original text simply contains {whole}, but can be understood as {part} {whole}. For the check, write something like \"Consider which way is clearer in your language.\"" } }, { "meaning": "Kematian Yesus Kristus bagi kita dilakukan dengan maksud atau tujuan untuk menebus kita.", "check": "Pertimbangkan apakah hubungan tujuan antara kematian-Nya dan penebusan kita dinyatakan dengan jelas dalam terjemahan Anda.", "trigger": { "name": "Intent/Result", "node_id": "1.3.0", "flags": [{ "name": "Intent/Result", "value": "Intent", "encoding_anchor": { "node_id": "1.3.0", "category": "Adposition", "event": "die-A", "result": "save-A" }, "weight": 4 }], "weight": 4 } }, { "meaning": "Yesus melakukan semua tindakan tersebut dengan maksud atau tujuan agar kita menjadi milik-Nya.", "check": "Pertimbangkan apakah hubungan tujuan ini tersampaikan dengan baik dalam terjemahan Anda.", "trigger": { "name": "Intent/Result", "node_id": "2.3.0", "flags": [{ "name": "Intent/Result", "value": "Intent", "encoding_anchor": { "node_id": "2.3.0", "category": "Adposition", "event": "do-A", "result": "belong-A" }, "weight": 4 }], "weight": 4 } }] }
	const queryParams = new URLSearchParams({
		settings: JSON.stringify({
			language_profile: params.vernacularProfile,
			mtt_level: params.mttLevel,
			lwc: params.lwcName,
			show_english: params.showEnglish,
			show_note_sources: params.showNoteSources,
			sensitivity: params.sensitivity
		}),
	})
	const response = await fetch(`https://copilot-dev.tabitha.bible/${params.bookName}/${params.chapterNo}/${params.verseNo}?${queryParams.toString()}`)
	validateHttpResponse(response)
	const json = await response.json()
	return json
}

async function getTnnBasedInfo(params, lwcVerse: string, tabithaNotes: string): Promise<any> {
	if (offline)
		return { "section4": { "sourcePointabilityRows": [{ "note": "He gave Himself", "tnnSource": "The expression 'gave Himself' indicates that Jesus died willingly. He was not forced to make this sacrifice.", "function": "BACKGROUND", "verseTerm": "He gave Himself", "lwcSpan": "memberi diri-Nya sendiri", "verdict": { "type": "SECTION 5", "subtype": "BACKGROUND", "pointer": null, "reason": null } }, { "note": "sentence continuation", "tnnSource": "Paul continued the description of Jesus that he began in the previous verse. In some languages it may be natural to continue the previous sentence here.", "function": "MECHANICS", "verseTerm": null, "lwcSpan": "Yesus Kristus memberi diri-Nya sendiri", "verdict": { "type": "SOLVED", "subtype": null, "pointer": null, "reason": "LWC starts a new sentence, resolving the sentence boundary" } }, { "note": "for us", "tnnSource": "Most scholars understand the phrase 'for us' to mean here 'on our behalf.' Christ died to help us, for our benefit.", "function": "BACKGROUND", "verseTerm": "for us", "lwcSpan": "untuk kita", "verdict": { "type": "CUT", "subtype": "NULL PAYLOAD", "pointer": "untuk kita", "reason": "The meaning 'on our behalf' is already realized in the standard Indonesian translation 'untuk kita'." } }, { "note": "us (inclusive)", "tnnSource": "This refers to all Christians, not just to Paul and Titus.", "function": "MECHANICS", "verseTerm": "us", "lwcSpan": "kita", "verdict": { "type": "SOLVED", "subtype": null, "pointer": null, "reason": "TaBiThA note 1 already covers the inclusive 'kita' referent" } }, { "note": "redeem", "tnnSource": "The Greek word that the BSB translates as 'redeem' refers to the process of freeing a slave. Here it is used in a figurative sense to refer to Jesus’ death as paying to set us free from the power of sin and death.", "function": "BACKGROUND", "verseTerm": "redeem", "lwcSpan": "menebus", "verdict": { "type": "SECTION 5", "subtype": "CULTURAL", "pointer": null, "reason": null } }, { "note": "from all lawlessness", "tnnSource": "This probably means that Jesus has freed his people from having to do any kind of bad thing. They are free to do what is right and good.", "function": "BACKGROUND", "verseTerm": "from all lawlessness", "lwcSpan": "dari kuasa semua tindakan jahat", "verdict": { "type": "SECTION 5", "subtype": "BACKGROUND", "pointer": null, "reason": null } }, { "note": "all lawlessness", "tnnSource": "The Greek word that the BSB translates as 'lawlessness' refers to not respecting or obeying God’s law.", "function": "BACKGROUND", "verseTerm": "all lawlessness", "lwcSpan": "tindakan jahat", "verdict": { "type": "SECTION 5", "subtype": "BACKGROUND", "pointer": null, "reason": null } }, { "note": "purify", "tnnSource": "The verb 'purify' here refers here to purifying people from sin. God would forgive the people of their past sins and help them not to want to sin any more. It does not imply that he would wash their bodies. Translate this in a way that is clear in your language.", "function": "MECHANICS", "verseTerm": "purify", "lwcSpan": "murni", "verdict": { "type": "RETAIN", "subtype": null, "pointer": null, "reason": null } }, { "note": "a people for His own possession", "tnnSource": "Jesus cleanses people because he wants them to belong to him and to no one else. The words 'His own possession' mean that these people are special to him.", "function": "BACKGROUND", "verseTerm": "a people for His own possession", "lwcSpan": "menjadi milik-Nya", "verdict": { "type": "SECTION 5", "subtype": "BACKGROUND", "pointer": null, "reason": null } }, { "note": "zealous", "tnnSource": "The Greek word that the BSB translates as 'zealous' describes people who are deeply committed to something and enthusiastic about it.", "function": "BACKGROUND", "verseTerm": "zealous", "lwcSpan": "dengan semangat", "verdict": { "type": "CUT", "subtype": "NULL PAYLOAD", "pointer": "dengan semangat", "reason": "The LWC's 'dengan semangat' already captures the enthusiastic meaning of zealous." } }, { "note": "for good deeds", "tnnSource": "The Greek word that the BSB translates as 'good deeds' is literally 'good works.'", "function": "BACKGROUND", "verseTerm": "for good deeds", "lwcSpan": "hal-hal yang baik", "verdict": { "type": "CUT", "subtype": "NULL PAYLOAD", "pointer": "hal-hal yang baik", "reason": "The LWC's 'hal-hal yang baik' already translates 'good deeds/works' clearly." } }], "notes": [{ "text": "purify: The verb 'purify' here refers to purifying people from sin. God would forgive the people of their past sins and help them not to want to sin any more. It does not imply that he would wash their bodies. Translate this in a way that is clear in your language." }], "excluded": [{ "note": "us (inclusive)", "reason": "SOLVED upstream — TaBiThA note 1 already covers the inclusive 'kita' referent" }, { "note": "sentence continuation", "reason": "SOLVED upstream — LWC starts a new sentence, resolving the sentence boundary" }] }, "section5": { "cultural": [{ "term": "redeem", "summary": "The Greek word refers to the process of freeing a slave. Here it is used in a figurative sense to refer to Jesus’ death as paying to set us free from the power of sin and death." }], "background": [{ "term": "He gave Himself", "summary": "Indicates that Jesus died willingly and was not forced to make this sacrifice." }, { "term": "from all lawlessness", "summary": "Probably means that Jesus has freed his people from having to do any kind of bad thing, so they are free to do what is right and good." }, { "term": "all lawlessness", "summary": "Refers to not respecting or obeying God’s law." }, { "term": "a people for His own possession", "summary": "Jesus cleanses people because he wants them to belong to him and to no one else, meaning they are special to him." }] }, "section6": { "keywords": ["slave"] }, "section7": { "decisions": [], "resolvedUpstream": [] } }
	// get prompt from Aquifer
	const contentId = (await getAquiferContentIds(params))[0]
	const response = await fetch(`https://api.aquifer.bible/resources/${contentId}`, {
		headers: {
			"api-key": process.env.API_KEY_AQUIFER,
		},
	})
	validateHttpResponse(response)
	const prompt = JSON.stringify({
		verseReference: `${params.bookName} ${params.chapterNo}:${params.verseNo}`,
		rigorMode: params.rigorMode,
		tnnText: await response.text(),
		lwcVerse,
		tabithaNotes
	})

	const systemPrompt = await Bun.file('prompts/tnn-system.txt').text()
	const responseJsonSchema = {
		type: 'object',
		properties: {
			section4: {
				type: 'object',
				description: 'SIL Translator Notes',
				properties: {
					sourcePointabilityRows: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								note: {
									type: 'string'
								},
								tnnSource: {
									type: 'string',
									description: 'Verbatim or close paraphrase of the TNN span.'
								},
								function: {
									type: 'string',
									enum: [
										'MECHANICS',
										'CULTURAL',
										'BACKGROUND'
									]
								},
								verseTerm: {
									type: ['string', 'null']
								},
								lwcSpan: {
									type: ['string', 'null']
								},
								verdict: {
									type: 'object',
									properties: {
										type: {
											type: 'string',
											enum: [
												'RETAIN',
												'SECTION 5',
												'CUT',
												'NOT APPLICABLE',
												'SOLVED'
											]
										},
										subtype: {
											type: ['string', 'null'],
											enum: [
												null,
												'CULTURAL',
												'BACKGROUND',
												'OUT OF SCOPE',
												'NULL PAYLOAD'
											]
										},
										pointer: {
											type: ['string', 'null']
										},
										reason: {
											type: ['string', 'null']
										}
									},
									required: ['type']
								}
							},
							required: [
								'note',
								'tnnSource',
								'function',
								'lwcSpan',
								'verdict'
							]
						}
					},
					notes: {
						type: 'array',
						description: 'Section 4 notes after filtering.',
						items: {
							type: 'object',
							properties: {
								text: {
									type: 'string'
								}
							},
							required: ['text']
						}
					},
					excluded: {
						type: 'array',
						description: 'Mechanics notes excluded from Section 4.',
						items: {
							type: 'object',
							properties: {
								note: {
									type: 'string'
								},
								reason: {
									type: 'string'
								}
							},
							required: [
								'note',
								'reason'
							]
						}
					}
				},
				required: [
					'sourcePointabilityRows',
					'notes',
					'excluded'
				]
			},

			section5: {
				type: 'object',
				description: 'Cultural Context Summary',
				properties: {
					cultural: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								term: {
									type: 'string'
								},
								summary: {
									type: 'string'
								}
							},
							required: [
								'term',
								'summary'
							]
						}
					},
					background: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								term: {
									type: 'string'
								},
								summary: {
									type: 'string'
								}
							},
							required: [
								'term',
								'summary'
							]
						}
					}
				},
				required: [
					'cultural',
					'background'
				]
			},

			section6: {
				type: 'object',
				description: 'Image Keywords',
				properties: {
					keywords: {
						type: 'array',
						items: {
							type: 'string'
						}
					}
				},
				required: ['keywords']
			},

			section7: {
				type: 'object',
				description: 'Consultant Note Candidate',
				properties: {
					decisions: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								status: {
									type: 'string',
									enum: [
										'RESOLVED UPSTREAM',
										'CONFLICT',
										'UNRESOLVED'
									]
								},
								text: {
									type: 'string'
								}
							},
							required: [
								'status',
								'text'
							]
						}
					},
					resolvedUpstream: {
						type: 'array',
						description: 'High-rigor trace lines that are not displayed as decisions.',
						items: {
							type: 'object',
							properties: {
								label: {
									type: 'string'
								},
								reason: {
									type: 'string'
								}
							},
							required: [
								'label',
								'reason'
							]
						}
					}
				},
				required: [
					'decisions',
					'resolvedUpstream'
				]
			}
		},
		required: [
			'section4',
			'section5',
			'section6',
			'section7'
		]
	}
	return JSON.parse(await askLlm(prompt, systemPrompt, responseJsonSchema))
}

// general formatting

function formatWeight(weight: number) {
	const max = 5
	let result = ''
	for (let n = 1; n <= max; ++n)
		result += n <= weight ? '●' : '○'
	return result
}

function formatVerdict(verdict: any) {
	switch (verdict.type) {
		case 'SECTION 5':
			return `→ SECTION 5 (${verdict.subtype})`
		case 'SOLVED':
			return `SOLVED — ${verdict.reason}`
		case 'CUT':
			return `CUT (${verdict.subtype} — ${verdict.reason})`
		default:
			return verdict.type
	}
}

// main

async function getPatches(input: any): Promise<any> {
	const copilotBasedInfo = await getCopilotBasedInfo(input)
	const tbtaSource = copilotBasedInfo.lwc_text
	const copilotQuestions = copilotBasedInfo.notes
	const tnnBasedInfo = await getTnnBasedInfo(input, tbtaSource, JSON.stringify(copilotQuestions))
	const readerLanguage = input.outputDocument == 'verbose' ? 'English' : input.lwcName
	return await translateJson({
		passageReference: `${input.bookName} ${input.chapterNo}:${input.verseNo}`,
		promptPreamble: markForTranslation(`${input.outputDocument == 'verbose' ? 'white-box (full audit)' : input.outputDocument == 'production' ? 'production (field)' : input.outputDocument} under prompt`, readerLanguage),
		promptVersion: 'v11',
		pagePreamble: markForTranslation('page', readerLanguage),
		rigorMode: input.rigorMode,
		lwcName: markForTranslation(input.lwcName, readerLanguage),
		flagsHeading: markForTranslation('SECTION 1 — PROVENANCE FLAGS', readerLanguage),
		flagNotes: copilotQuestions.flatMap(question =>
			question.trigger.flags.map(flag => ({
				title: question.trigger.name,
				weight: formatWeight(question.trigger.weight),
				trace: `node ${question.trigger.node_id}  ·  ${flag.encoding_anchor.category}  ·  concept: ${flag.encoding_anchor.concept}  ·  index ${flag.encoding_anchor.noun_index}  ·  value: ${flag.value}`,
				lwcText: `${question.meaning} ${question.check}`,
				btText: markForTranslation(`${question.meaning} ${question.check}`, 'English', input.lwcName)
			}))
		),
		sourceHeading: markForTranslation('SECTION 2 — TBTA LWC VERSE', readerLanguage),
		sourceBody: tbtaSource,
		notesHeading: markForTranslation('SECTION 3 — TaBiThA SEMANTIC NOTES', readerLanguage),
		notes: copilotQuestions.map((question, index) => ({
			ordinal: index + 1,
			name: markForTranslation(question.trigger.name, readerLanguage),
			text: question.meaning + ' ' + question.check
		})),
		tnnHeading: markForTranslation('SECTION 4 — SIL TRANSLATOR NOTES', readerLanguage),
		tnnTraces: tnnBasedInfo.section4.sourcePointabilityRows.filter(row => row.verdict.type != 'RETAIN').map(row => ({
			note: row.note,
			function: row.function,
			lwcSpan1: row.lwcSpan != 'NOT IN LWC' ? `“${row.lwcSpan}”` : '',
			lwcSpan2: row.lwcSpan == 'NOT IN LWC' ? row.lwcSpan : '',
			verdict1: row.verdict.type == 'CUT' ? formatVerdict(row.verdict) : '',
			verdict2: !(row.verdict.type == 'CUT' || row.verdict.type == 'SECTION 5') ? formatVerdict(row.verdict) : '',
			verdict3: row.verdict.type == 'SECTION 5' ? formatVerdict(row.verdict) : '',
		})),
		retainedNone: tnnBasedInfo.section4.sourcePointabilityRows.filter(row => row.verdict.type == 'RETAIN').length == 0,
		retainedNoneText: markForTranslation('No mechanics notes were retained for this passage.', readerLanguage),
		retainedNotes: tnnBasedInfo.section4.notes.map(row => ({
			text: markForTranslation(row.text, readerLanguage)
		})),
		excludedNotes: tnnBasedInfo.section4.excluded.map(row => ({
			text: `${row.note}: ${row.reason}`
		})),
		contextHeading: markForTranslation('SECTION 5 — CULTURAL & CONTEXTUAL BACKGROUND', readerLanguage),
		contextNotesCulturalHeading: markForTranslation('Cultural', readerLanguage),
		contextNotesCultural: tnnBasedInfo.section5.cultural.map(row => ({
			title: markForTranslation(row.term, readerLanguage),
			text: markForTranslation(row.summary, readerLanguage)
		})),
		contextNotesBackgroundHeading: markForTranslation('Background', readerLanguage),
		contextNotesBackground: tnnBasedInfo.section5.background.map(row => ({
			title: markForTranslation(row.term, readerLanguage),
			text: markForTranslation(row.summary, readerLanguage)
		})),
		imagesHeading: markForTranslation('SECTION 6 — IMAGE KEYWORDS', readerLanguage),
		imageNotes: tnnBasedInfo.section6.keywords.map(keyword => ({
			title: keyword
		})),
		consultantHeading: markForTranslation('SECTION 7 — CONSULTANT DECISION', readerLanguage),
		consultantNotes: tnnBasedInfo.section7.decisions.length == 0 ? [{ text: markForTranslation('No Section 7 candidate was identified.', readerLanguage) }] : tnnBasedInfo.section7.decisions.map(decision => ({
			text: `${markForTranslation(decision.status, readerLanguage)} — ${markForTranslation(decision.text, readerLanguage)}`
		}))
	})
}

const input = await Bun.stdin.json()

if (input.outputFormat == 'docx') {
	const template = await Bun.file(`templates/${input.outputDocument}.docx`).arrayBuffer()

	const handler = new TemplateHandler()
	const output = await handler.process(template, await getPatches(input))

	await Bun.write(Bun.stdout, output)
}
else if (input.outputFormat == 'usfm') {
	if (input.outputDocument == 'production') {
		let items = []
		let chapterNo = input.chapterNo
		let verseNo = input.verseNo
		let numVersesInChapter = getNumVersesInChapter(input.bookName, chapterNo)
		const thruChapterNo = input.thruChapterNo ?? chapterNo
		const thruVerseNo = input.thruVerseNo ?? verseNo
		while (chapterNo < thruChapterNo || (chapterNo == thruChapterNo && verseNo <= thruVerseNo)) {
			input.chapterNo = chapterNo
			input.verseNo = verseNo
			const patches = await getPatches(input)

			if (verseNo == 1) {
				if (chapterNo == 1)
					items.push(`\\id ${usfmBookCodeByBookName.filter(pair => pair.key == input.bookName)[0].value}\n`)
				items.push(`\\c ${chapterNo}\n`)
			}
			items.push(`\\v ${verseNo} ${patches.sourceBody}\n`)
			items.push(`\\s ${patches.notesHeading}\n`)
			for (const question of patches.notes)
				items.push(`\\iex ${question.name} — ${question.text}\n`)
			items.push(`\\s ${patches.tnnHeading}\n`)
			if (patches.retainedNone)
				items.push(`\\iex ${patches.retainedNoneText}\n`)
			for (const retainedNote of patches.retainedNotes)
				items.push(`\\iex ${retainedNote.text}\n`)
			items.push(`\\s ${patches.contextHeading}\n`)
			for (const contextNote of patches.contextNotesCultural)
				items.push(`\\iex ${contextNote.title} — ${contextNote.text}\n`)
			for (const contextNote of patches.contextNotesBackground)
				items.push(`\\iex ${contextNote.title} — ${contextNote.text}\n`)
			items.push(`\\s ${patches.imagesHeading}\n`)
			for (const imageNote of patches.imageNotes)
				items.push(`\\iex ${imageNote.title}\n`)
			items.push(`\\s ${patches.consultantHeading}\n`)
			for (const consultantNote of patches.consultantNotes)
				items.push(`\\iex ${consultantNote.text}\n`)
			while (++verseNo > numVersesInChapter) {
				verseNo = 0
				numVersesInChapter = getNumVersesInChapter(input.bookName, ++chapterNo)
			}
		}
		await Bun.write(Bun.stdout, items.join(''))
	}
	else {
		console.error(`USFM output format does not support this document: ${input.outputDocument}`)
	}
}
else {
	console.error(`Bad output format: ${input.outputFormat}`)
}
