import { v4 as uuidv4 } from 'uuid';
import { TopicItem } from '../state/types.js';

export class TopicManager {
  private currentTopic: TopicItem | null = null;
  private topicStack: TopicItem[] = []; // Stack of suspended topics
  private pastTopicsHistory: TopicItem[] = [];

  constructor() {
    this.currentTopic = {
      id: uuidv4(),
      name: 'General Catchup',
      summary: 'Casual opening conversation',
      keywords: ['general', 'hello', 'chat'],
      startedAt: Date.now(),
      lastActiveAt: Date.now(),
      unresolvedQuestions: []
    };
  }

  public getCurrentTopic(): TopicItem | null {
    return this.currentTopic;
  }

  public getTopicStack(): TopicItem[] {
    return [...this.topicStack];
  }

  public getTopicStackSize(): number {
    return this.topicStack.length;
  }

  /**
   * Switch to a new topic: pushes current topic onto stack and sets new current topic.
   */
  public pushNewTopic(topicName: string, summary: string, keywords: string[] = []): TopicItem {
    if (this.currentTopic && this.currentTopic.name !== topicName) {
      this.currentTopic.lastActiveAt = Date.now();
      this.topicStack.push(this.currentTopic);
      console.log(`[TOPIC CHANGE] ${this.currentTopic.name} -> ${topicName}`);
    }

    const newTopic: TopicItem = {
      id: uuidv4(),
      name: topicName,
      summary,
      keywords,
      startedAt: Date.now(),
      lastActiveAt: Date.now(),
      unresolvedQuestions: []
    };

    this.currentTopic = newTopic;
    this.pastTopicsHistory.push(newTopic);
    return newTopic;
  }

  /**
   * Resume previous topic from stack (Pop).
   */
  public popResumeTopic(): TopicItem | null {
    if (this.topicStack.length === 0) {
      return this.currentTopic;
    }

    const resumedTopic = this.topicStack.pop()!;
    resumedTopic.lastActiveAt = Date.now();
    const prevName = this.currentTopic?.name;
    this.currentTopic = resumedTopic;
    console.log(`[TOPIC RETURN] ${prevName} -> Resumed "${resumedTopic.name}" from stack`);
    return resumedTopic;
  }

  /**
   * Infer topic change heuristically from user utterance.
   */
  public inferAndTrackTopic(text: string): { changed: boolean; isReturn: boolean; currentTopic: TopicItem; cancelledTopicName?: string } {
    const lower = text.toLowerCase();

    // Check explicit cancellation (e.g. "actually forget the story", "never mind React")
    const cancelMatch = lower.match(/\b(?:actually\s+)?(?:forget|never\s+mind|leave|scratch)\s+(?:the\s+|about\s+)?([a-z0-9_\-\s]+?)(?:\s+(?:tell|explain|what|let's|talk|how)|\.|\?|,|$)/i);
    let cancelledTopicName: string | undefined;
    if (cancelMatch) {
      cancelledTopicName = cancelMatch[1].trim();
      console.log(`[TASK CANCELLED] User explicitly cancelled: "${cancelledTopicName}"`);
    }

    // Check resumption (e.g. "going back to that story", "coming back to college")
    const isReturn = /\b(anyway|coming back|going back|back to what|where were we|as i was saying|wapas|purani baat|going back to)\b/i.test(lower);
    if (isReturn && this.topicStack.length > 0) {
      const resumed = this.popResumeTopic()!;
      return { changed: true, isReturn: true, currentTopic: resumed, cancelledTopicName };
    }

    // Heuristic topic detection (ordered with specific new topics first)
    if (/\b(robot|robots|robotics)\b/i.test(lower)) {
      if (this.currentTopic?.name !== 'Robots & Automation') {
        const newTopic = this.pushNewTopic('Robots & Automation', 'Discussion about robotics and automation', ['robots', 'hardware', 'ai']);
        return { changed: true, isReturn: false, currentTopic: newTopic, cancelledTopicName };
      }
    } else if (/\b(python|django|fastapi|pandas|numpy)\b/i.test(lower)) {
      if (this.currentTopic?.name !== 'Python & Programming') {
        const newTopic = this.pushNewTopic('Python & Programming', 'Python programming, backend, and data science', ['python', 'code']);
        return { changed: true, isReturn: false, currentTopic: newTopic, cancelledTopicName };
      }
    } else if (/\b(react|hooks|useeffect|usestate|frontend|components)\b/i.test(lower) && !cancelledTopicName?.includes('react')) {
      if (this.currentTopic?.name !== 'React & Frontend') {
        const newTopic = this.pushNewTopic('React & Frontend', 'React development, architecture, and web tech', ['react', 'code']);
        return { changed: true, isReturn: false, currentTopic: newTopic, cancelledTopicName };
      }
    } else if (/\b(javascript|typescript|js|ts)\b/i.test(lower)) {
      if (this.currentTopic?.name !== 'JavaScript & Web') {
        const newTopic = this.pushNewTopic('JavaScript & Web', 'JavaScript ecosystem and modern web development', ['javascript', 'web']);
        return { changed: true, isReturn: false, currentTopic: newTopic, cancelledTopicName };
      }
    } else if (/\b(node|nodejs|node\.js|backend runtime)\b/i.test(lower)) {
      if (this.currentTopic?.name !== 'Node.js & Backend') {
        const newTopic = this.pushNewTopic('Node.js & Backend', 'Node.js server runtime and APIs', ['node', 'backend']);
        return { changed: true, isReturn: false, currentTopic: newTopic, cancelledTopicName };
      }
    } else if (/\b(tell me a story|fairytale|narrative|kahani|write a story|brief story)\b/i.test(lower) && !cancelledTopicName?.includes('story')) {
      if (this.currentTopic?.name !== 'Stories') {
        const newTopic = this.pushNewTopic('Stories', 'Storytelling and imaginative tales', ['story', 'fiction']);
        return { changed: true, isReturn: false, currentTopic: newTopic, cancelledTopicName };
      }
    } else if (/\b(joke|funny|laugh|humor|chutkula|hasi)\b/i.test(lower)) {
      if (this.currentTopic?.name !== 'Jokes & Humor') {
        const newTopic = this.pushNewTopic('Jokes & Humor', 'Jokes, puns, and witty banter', ['joke', 'humor']);
        return { changed: true, isReturn: false, currentTopic: newTopic, cancelledTopicName };
      }
    } else if (/\b(placement|placements|interview|interviews|career|placement season)\b/i.test(lower)) {
      if (this.currentTopic?.name !== 'Career & Placements') {
        const newTopic = this.pushNewTopic('Career & Placements', 'Job placements, interviews, and preparation', ['placement', 'career']);
        return { changed: true, isReturn: false, currentTopic: newTopic, cancelledTopicName };
      }
    } else if (/\b(college|university|campus|classes|professors|semester|hostel)\b/i.test(lower)) {
      if (this.currentTopic?.name !== 'College Life') {
        const newTopic = this.pushNewTopic('College Life', 'Discussion about college, academics, and campus life', ['college', 'campus']);
        return { changed: true, isReturn: false, currentTopic: newTopic, cancelledTopicName };
      }
    } else if (/\b(movie|movies|film|cinema|favorite movie|actor|watching)\b/i.test(lower)) {
      if (this.currentTopic?.name !== 'Movies & Cinema') {
        const newTopic = this.pushNewTopic('Movies & Cinema', 'Favorite films, cinema, and shows', ['movies', 'cinema']);
        return { changed: true, isReturn: false, currentTopic: newTopic, cancelledTopicName };
      }
    } else if (/\b(weather|temperature|forecast|rain|mausam|barish)\b/i.test(lower)) {
      if (this.currentTopic?.name !== 'Weather') {
        const newTopic = this.pushNewTopic('Weather', 'Discussion about current weather conditions', ['weather', 'forecast', 'rain']);
        return { changed: true, isReturn: false, currentTopic: newTopic, cancelledTopicName };
      }
    } else if (/\b(dinner|food|party|weekend|plan for tonight|what are you doing tonight|tonight|chill)\b/i.test(lower)) {
      if (this.currentTopic?.name !== 'Plans & Outings') {
        const newTopic = this.pushNewTopic('Plans & Outings', 'Social plans, dinner, and leisure', ['plans', 'dinner', 'evening']);
        return { changed: true, isReturn: false, currentTopic: newTopic, cancelledTopicName };
      }
    }

    // Still on current topic
    if (this.currentTopic) {
      this.currentTopic.lastActiveAt = Date.now();
    }
    return { changed: false, isReturn: false, currentTopic: this.currentTopic!, cancelledTopicName };
  }

  public getContextSummary(): string {
    const stackNames = this.topicStack.map(t => t.name).join(' -> ');
    return `Current Topic: ${this.currentTopic?.name || 'General'}. Topic Stack [${stackNames}]`;
  }
}
