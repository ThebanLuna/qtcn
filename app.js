class AdvancedQuizSystem {
    constructor() {
        this.sections = [];
        this.currentSection = null;
        this.currentQuestionIndex = 0;
        this.userProgress = {};
        this.animationTimeline = gsap.timeline();

        this.dom = {
            chapterList: document.getElementById('chapter-list'),
            questionTitle: document.querySelector('.question-title'),
            optionsGrid: document.querySelector('.options-grid'),
            prevBtn: document.querySelector('.prev-btn'),
            nextBtn: document.querySelector('.next-btn'),
            continueBtn: document.querySelector('.continue-btn'),
            progressValue: document.querySelector('.progress-value'),
            progressRing: document.querySelector('.progress-ring-circle'),
            correctCount: document.querySelector('.correct-count'),
            incorrectCount: document.querySelector('.incorrect-count'),
            completionModal: document.querySelector('.completion-modal'),
            totalQuestions: document.querySelector('.total-questions'),
            currentQuestion: document.querySelector('.current-question')
        };

        this.init();

        document.querySelector('.mobile-menu-btn').addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('active');
        });
    }

    selectQuestion(sectionId, questionIndex) {
        // ... code cũ
        
        // Tự động đóng menu khi chọn câu hỏi trên mobile
        if(window.innerWidth <= 768) {
            document.querySelector('.sidebar').classList.remove('active');
        }
    }

    async init() {
        await this.loadData();
        this.loadProgress();
        this.renderChapters();
        this.setupEventListeners();
        this.updateProgressRing();
        this.renderQuestionCounts();
    }

    async loadData() {
        try {
            const response = await fetch('questions.json');
            const data = await response.json();
            this.sections = data.sections;
        } catch (error) {
            console.error('Lỗi tải dữ liệu:', error);
        }
    }

    loadProgress() {
        const savedProgress = localStorage.getItem('quizProgress');
        if (savedProgress) {
            this.userProgress = JSON.parse(savedProgress);
        }
    }

    saveProgress() {
        localStorage.setItem('quizProgress', JSON.stringify(this.userProgress));
    }

    renderChapters() {
        this.dom.chapterList.innerHTML = this.sections.map(section => `
            <div class="chapter-item">
                <div class="chapter-header" data-id="${section.id}">
                    <span class="chapter-title">${section.title}</span>
                    <span class="chapter-toggle">▼</span>
                </div>
                <div class="chapter-content">
                    <div class="chapter-questions">
                        ${section.questions.map((q, index) => `
                            <div class="question-item 
                                ${this.getQuestionStatus(section.id, q.id)}"
                                data-section="${section.id}"
                                data-index="${index}">
                                Câu ${index + 1}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    }

    getQuestionStatus(sectionId, questionId) {
        const key = `s${sectionId}-q${questionId}`;
        return this.userProgress[key]?.status || '';
    }

    setupEventListeners() {
        // Chapter accordion
        this.dom.chapterList.addEventListener('click', e => {
            const header = e.target.closest('.chapter-header');
            if (header) {
                const content = header.nextElementSibling;
                const isOpen = content.style.maxHeight;

                document.querySelectorAll('.chapter-content').forEach(el => {
                    el.style.maxHeight = null;
                    el.previousElementSibling.querySelector('.chapter-toggle').style.transform = 'rotate(0deg)';
                });

                if (!isOpen) {
                    content.style.maxHeight = content.scrollHeight + 'px';
                    header.querySelector('.chapter-toggle').style.transform = 'rotate(180deg)';
                }
            }

            // Handle question click
            const questionItem = e.target.closest('.question-item');
            if (questionItem) {
                const sectionId = parseInt(questionItem.dataset.section);
                const questionIndex = parseInt(questionItem.dataset.index);
                this.selectQuestion(sectionId, questionIndex);
            }
        });

        // Navigation buttons
        this.dom.prevBtn.addEventListener('click', () => this.navigate(-1));
        this.dom.nextBtn.addEventListener('click', () => this.navigate(1));
        this.dom.continueBtn.addEventListener('click', () => this.navigate(1));

        // Modal close
        document.querySelector('.close-modal').addEventListener('click', () => {
            gsap.to('.completion-modal', {
                opacity: 0,
                duration: 0.3,
                onComplete: () => {
                    document.querySelector('.completion-modal').style.display = 'none';
                }
            });
        });

        document.querySelector('.reset-btn').addEventListener('click', () => {
            this.resetQuiz();
        });

    }

    resetQuiz() {
        // Reset biến lưu trữ
        this.userProgress = {};
        this.currentQuestionIndex = 0;
        
        // Xóa dữ liệu local storage
        localStorage.removeItem('quizProgress');
        
        // Cập nhật giao diện
        this.renderChapters();
        this.renderQuestion();
        this.updateProgressRing();
        this.renderQuestionCounts();
        
        // Hiệu ứng
        gsap.from('.question-card', {
            rotationY: 180,
            duration: 1,
            ease: "power4.out"
        });
    }

    selectQuestion(sectionId, questionIndex) {
        this.currentSection = this.sections.find(s => s.id === sectionId);
        this.currentQuestionIndex = questionIndex;
        this.renderQuestion();
        this.animateQuestionTransition();
    }

    renderQuestion() {
        const question = this.currentSection.questions[this.currentQuestionIndex];
        this.dom.questionTitle.textContent = question.q;
        this.dom.optionsGrid.innerHTML = question.o
            .map((opt, index) => `
                <button class="option-btn 
                    ${this.getAnswerClass(question, index)}"
                    data-index="${index}"
                    ${this.isAnswered(question) ? 'disabled' : ''}>
                    ${opt}
                </button>
            `).join('');

        this.dom.currentQuestion.textContent = this.currentQuestionIndex + 1;
        this.dom.totalQuestions.textContent = this.currentSection.questions.length;
        this.setupOptionListeners(question);
    }

    getAnswerClass(question, index) {
        const key = this.getQuestionKey(question.id);
        if (this.userProgress[key]) {
            return index === question.a ? 'correct' :
                index === this.userProgress[key].selected ? 'incorrect' : '';
        }
        return '';
    }

    isAnswered(question) {
        return !!this.userProgress[this.getQuestionKey(question.id)];
    }

    setupOptionListeners(question) {
        document.querySelectorAll('.option-btn').forEach(btn => {
            if (!this.isAnswered(question)) {
                btn.addEventListener('click', () => this.handleAnswer(btn, question));
            }
        });
    }

    handleAnswer(button, question) {
        const selectedIndex = parseInt(button.dataset.index);
        const isCorrect = selectedIndex === question.a;
        const key = this.getQuestionKey(question.id);

        // Save progress
        this.userProgress[key] = {
            status: isCorrect ? 'correct' : 'incorrect',
            selected: selectedIndex
        };

        // Update UI
        button.classList.add(isCorrect ? 'correct' : 'incorrect');
        if (!isCorrect) {
            document.querySelector(`.option-btn[data-index="${question.a}"]`)
                .classList.add('correct');
        }

        // Animate and enable continue button
        this.animateAnswerFeedback(isCorrect);
        this.saveProgress();
        this.updateProgressRing();
        this.renderQuestionCounts();
    }

    animateQuestionTransition() {
        gsap.from('.question-card', {
            duration: 0.5,
            opacity: 0,
            y: 50,
            rotateX: -30,
            ease: "power2.out"
        });
    }

    animateAnswerFeedback(isCorrect) {
        gsap.to('.continue-btn', {
            duration: 0.3,
            scale: 1.1,
            yoyo: true,
            repeat: 1,
            ease: "power2.inOut"
        });

        if (isCorrect) {
            gsap.to('.correct-count', {
                duration: 0.5,
                scale: 1.2,
                yoyo: true,
                repeat: 1
            });
        } else {
            gsap.to('.incorrect-count', {
                duration: 0.5,
                scale: 1.2,
                yoyo: true,
                repeat: 1
            });
        }
    }

    updateProgressRing() {
        const total = this.currentSection.questions.length;
        const answered = Object.keys(this.userProgress)
            .filter(key => key.startsWith(`s${this.currentSection.id}-q`)).length;
        const progress = answered / total;
        const circumference = 2 * Math.PI * 25;

        this.dom.progressRing.style.strokeDasharray = circumference;
        this.dom.progressRing.style.strokeDashoffset = circumference * (1 - progress);
        this.dom.progressValue.textContent = `${Math.round(progress * 100)}%`;
    }

    renderQuestionCounts() {
        const counts = Object.values(this.userProgress).reduce((acc, curr) => {
            curr.status === 'correct' ? acc.correct++ : acc.incorrect++;
            return acc;
        }, { correct: 0, incorrect: 0 });

        this.dom.correctCount.textContent = `👍 ${counts.correct}`;
        this.dom.incorrectCount.textContent = `👎 ${counts.incorrect}`;

        // Animation cho số liệu
        gsap.to([this.dom.correctCount, this.dom.incorrectCount], {
            duration: 0.3,
            scale: 1.1,
            yoyo: true,
            repeat: 1
        });
    }

    navigate(direction) {
        const newIndex = this.currentQuestionIndex + direction;
        if (newIndex >= 0 && newIndex < this.currentSection.questions.length) {
            this.currentQuestionIndex = newIndex;
            this.renderQuestion();
            this.animateQuestionTransition();
        } else if (newIndex >= this.currentSection.questions.length) {
            this.showCompletionModal();
        }
    }

    showCompletionModal() {
        const totalQuestions = this.currentSection.questions.length;
        const correctAnswers = Object.values(this.userProgress)
            .filter(progress => progress.status === 'correct').length;

        // Hiệu ứng confetti
        this.createConfetti();

        // Hiển thị modal
        gsap.fromTo('.completion-modal',
            { opacity: 0, scale: 0.8 },
            {
                opacity: 1,
                scale: 1,
                duration: 0.5,
                ease: "elastic.out(1, 0.3)",
                onStart: () => {
                    document.querySelector('.completion-modal').style.display = 'grid';
                }
            }
        );

        // Cập nhật số liệu
        document.querySelector('.correct-answers').textContent = correctAnswers;
        document.querySelector('.total-questions').textContent = totalQuestions;
        document.querySelector('.score').textContent = Math.round((correctAnswers / totalQuestions) * 100);
    }

    createConfetti() {
        const colors = ['#ff718d', '#fdff6a', '#59acff', '#5aff5a'];
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti-particle';
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
            document.querySelector('.confetti').appendChild(confetti);

            gsap.fromTo(confetti, {
                x: Math.random() * innerWidth,
                y: -100,
                rotation: Math.random() * 360,
                scale: Math.random()
            }, {
                y: innerHeight + 100,
                duration: 2 + Math.random() * 3,
                ease: "power1.out",
                onComplete: () => confetti.remove()
            });
        }
    }

    getQuestionKey(questionId) {
        return `s${this.currentSection.id}-q${questionId}`;
    }
}

// Khởi tạo hệ thống
document.addEventListener('DOMContentLoaded', () => new AdvancedQuizSystem());