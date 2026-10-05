export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      achievements: {
        Row: {
          created_at: string;
          criteria: Json;
          description: string;
          icon: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          criteria: Json;
          description: string;
          icon: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          criteria?: Json;
          description?: string;
          icon?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      bookmarked_questions: {
        Row: {
          created_at: string;
          id: string;
          question_id: string;
          student_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          question_id: string;
          student_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          question_id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookmarked_questions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "quiz_questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookmarked_questions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      case_attempts: {
        Row: {
          case_id: string;
          communication_response: Json | null;
          completed_at: string | null;
          created_at: string;
          current_stage: string;
          differential_submission: Json | null;
          exams_performed: Json;
          final_diagnosis: string | null;
          final_diagnosis_details: Json | null;
          history_questions_asked: Json;
          id: string;
          interpretation_answer: string | null;
          investigations_ordered: Json;
          management_choices: Json;
          management_path_outcome: string | null;
          management_reasoning: string | null;
          mode: string;
          room_id: string | null;
          score_breakdown: Json | null;
          started_at: string;
          status: string;
          student_id: string;
          total_score: number | null;
        };
        Insert: {
          case_id: string;
          communication_response?: Json | null;
          completed_at?: string | null;
          created_at?: string;
          current_stage?: string;
          differential_submission?: Json | null;
          exams_performed?: Json;
          final_diagnosis?: string | null;
          final_diagnosis_details?: Json | null;
          history_questions_asked?: Json;
          id?: string;
          interpretation_answer?: string | null;
          investigations_ordered?: Json;
          management_choices?: Json;
          management_path_outcome?: string | null;
          management_reasoning?: string | null;
          mode?: string;
          room_id?: string | null;
          score_breakdown?: Json | null;
          started_at?: string;
          status?: string;
          student_id: string;
          total_score?: number | null;
        };
        Update: {
          case_id?: string;
          communication_response?: Json | null;
          completed_at?: string | null;
          created_at?: string;
          current_stage?: string;
          differential_submission?: Json | null;
          exams_performed?: Json;
          final_diagnosis?: string | null;
          final_diagnosis_details?: Json | null;
          history_questions_asked?: Json;
          id?: string;
          interpretation_answer?: string | null;
          investigations_ordered?: Json;
          management_choices?: Json;
          management_path_outcome?: string | null;
          management_reasoning?: string | null;
          mode?: string;
          room_id?: string | null;
          score_breakdown?: Json | null;
          started_at?: string;
          status?: string;
          student_id?: string;
          total_score?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "case_attempts_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_attempts_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      case_room_messages: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          message: string;
          room_id: string;
          student_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind?: string;
          message: string;
          room_id: string;
          student_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          message?: string;
          room_id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_room_messages_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "case_rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_room_messages_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      case_room_votes: {
        Row: {
          created_at: string;
          decision_type: string;
          id: string;
          option: string;
          room_id: string;
          student_id: string;
        };
        Insert: {
          created_at?: string;
          decision_type: string;
          id?: string;
          option: string;
          room_id: string;
          student_id: string;
        };
        Update: {
          created_at?: string;
          decision_type?: string;
          id?: string;
          option?: string;
          room_id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_room_votes_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "case_rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_room_votes_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      case_rooms: {
        Row: {
          case_id: string;
          created_at: string;
          created_by: string | null;
          differential_board: Json;
          group_id: string | null;
          id: string;
          name: string;
          shared_notes: string;
          status: string;
          timer_seconds: number;
          updated_at: string;
        };
        Insert: {
          case_id: string;
          created_at?: string;
          created_by?: string | null;
          differential_board?: Json;
          group_id?: string | null;
          id?: string;
          name?: string;
          shared_notes?: string;
          status?: string;
          timer_seconds?: number;
          updated_at?: string;
        };
        Update: {
          case_id?: string;
          created_at?: string;
          created_by?: string | null;
          differential_board?: Json;
          group_id?: string | null;
          id?: string;
          name?: string;
          shared_notes?: string;
          status?: string;
          timer_seconds?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_rooms_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_rooms_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_rooms_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      cases: {
        Row: {
          answer_key: Json;
          challenge_end: string | null;
          challenge_start: string | null;
          clinical_setting: string;
          communication_task: Json | null;
          completions_count: number;
          correct_diagnosis: string;
          correct_differentials: string[];
          created_at: string;
          debrief: Json;
          diagnosis_options: string[];
          differential_prompt: string;
          difficulty: string;
          estimated_minutes: number;
          examinations: Json;
          history_categories: Json;
          id: string;
          initial_presentation: string;
          interpretation_task: Json;
          investigations: Json;
          is_published: boolean;
          is_weekly_challenge: boolean;
          management_options: Json;
          mode: string;
          organ_system: string;
          outcomes: Json;
          patient: Json;
          scoring_weights: Json;
          specialty: string;
          teaser: string;
          title: string;
          topic: string;
          xp_reward: number;
          year_level: number;
        };
        Insert: {
          answer_key?: Json;
          challenge_end?: string | null;
          challenge_start?: string | null;
          clinical_setting?: string;
          communication_task?: Json | null;
          completions_count?: number;
          correct_diagnosis?: string;
          correct_differentials?: string[];
          created_at?: string;
          debrief?: Json;
          diagnosis_options?: string[];
          differential_prompt?: string;
          difficulty?: string;
          estimated_minutes?: number;
          examinations?: Json;
          history_categories?: Json;
          id?: string;
          initial_presentation?: string;
          interpretation_task?: Json;
          investigations?: Json;
          is_published?: boolean;
          is_weekly_challenge?: boolean;
          management_options?: Json;
          mode?: string;
          organ_system?: string;
          outcomes?: Json;
          patient?: Json;
          scoring_weights?: Json;
          specialty?: string;
          teaser?: string;
          title?: string;
          topic?: string;
          xp_reward?: number;
          year_level?: number;
        };
        Update: {
          answer_key?: Json;
          challenge_end?: string | null;
          challenge_start?: string | null;
          clinical_setting?: string;
          communication_task?: Json | null;
          completions_count?: number;
          correct_diagnosis?: string;
          correct_differentials?: string[];
          created_at?: string;
          debrief?: Json;
          diagnosis_options?: string[];
          differential_prompt?: string;
          difficulty?: string;
          estimated_minutes?: number;
          examinations?: Json;
          history_categories?: Json;
          id?: string;
          initial_presentation?: string;
          interpretation_task?: Json;
          investigations?: Json;
          is_published?: boolean;
          is_weekly_challenge?: boolean;
          management_options?: Json;
          mode?: string;
          organ_system?: string;
          outcomes?: Json;
          patient?: Json;
          scoring_weights?: Json;
          specialty?: string;
          teaser?: string;
          title?: string;
          topic?: string;
          xp_reward?: number;
          year_level?: number;
        };
        Relationships: [];
      };
      challenge_participants: {
        Row: {
          challenge_id: string;
          created_at: string;
          display_name: string;
          group_name: string | null;
          id: string;
          mode: string;
          rank: number | null;
          score: number;
          student_id: string | null;
          team_id: string | null;
          team_name: string | null;
          time_taken_seconds: number;
        };
        Insert: {
          challenge_id: string;
          created_at?: string;
          display_name: string;
          group_name?: string | null;
          id?: string;
          mode?: string;
          rank?: number | null;
          score?: number;
          student_id?: string | null;
          team_id?: string | null;
          team_name?: string | null;
          time_taken_seconds?: number;
        };
        Update: {
          challenge_id?: string;
          created_at?: string;
          display_name?: string;
          group_name?: string | null;
          id?: string;
          mode?: string;
          rank?: number | null;
          score?: number;
          student_id?: string | null;
          team_id?: string | null;
          team_name?: string | null;
          time_taken_seconds?: number;
        };
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey";
            columns: ["challenge_id"];
            isOneToOne: false;
            referencedRelation: "weekly_challenges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "challenge_participants_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      flashcard_decks: {
        Row: {
          created_at: string;
          description: string;
          difficulty: string;
          id: string;
          is_official: boolean;
          is_published: boolean;
          organ_system: string;
          owner_student_id: string | null;
          subject: string;
          tags: string[];
          title: string;
          topic: string;
          updated_at: string;
          year: number;
        };
        Insert: {
          created_at?: string;
          description?: string;
          difficulty?: string;
          id?: string;
          is_official?: boolean;
          is_published?: boolean;
          organ_system?: string;
          owner_student_id?: string | null;
          subject?: string;
          tags?: string[];
          title?: string;
          topic?: string;
          updated_at?: string;
          year?: number;
        };
        Update: {
          created_at?: string;
          description?: string;
          difficulty?: string;
          id?: string;
          is_official?: boolean;
          is_published?: boolean;
          organ_system?: string;
          owner_student_id?: string | null;
          subject?: string;
          tags?: string[];
          title?: string;
          topic?: string;
          updated_at?: string;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: "flashcard_decks_owner_student_id_fkey";
            columns: ["owner_student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      flashcard_reviews: {
        Row: {
          created_at: string;
          due_date: string;
          ease_factor: number;
          flashcard_id: string;
          id: string;
          interval_days: number;
          last_rating: string | null;
          last_reviewed_at: string | null;
          repetitions: number;
          student_id: string;
        };
        Insert: {
          created_at?: string;
          due_date?: string;
          ease_factor?: number;
          flashcard_id: string;
          id?: string;
          interval_days?: number;
          last_rating?: string | null;
          last_reviewed_at?: string | null;
          repetitions?: number;
          student_id: string;
        };
        Update: {
          created_at?: string;
          due_date?: string;
          ease_factor?: number;
          flashcard_id?: string;
          id?: string;
          interval_days?: number;
          last_rating?: string | null;
          last_reviewed_at?: string | null;
          repetitions?: number;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flashcard_reviews_flashcard_id_fkey";
            columns: ["flashcard_id"];
            isOneToOne: false;
            referencedRelation: "flashcards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flashcard_reviews_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      flashcards: {
        Row: {
          back: string;
          cloze_text: string | null;
          created_at: string;
          deck_id: string;
          front: string;
          id: string;
          image_url: string | null;
          position: number;
          type: string;
        };
        Insert: {
          back?: string;
          cloze_text?: string | null;
          created_at?: string;
          deck_id: string;
          front?: string;
          id?: string;
          image_url?: string | null;
          position?: number;
          type?: string;
        };
        Update: {
          back?: string;
          cloze_text?: string | null;
          created_at?: string;
          deck_id?: string;
          front?: string;
          id?: string;
          image_url?: string | null;
          position?: number;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flashcards_deck_id_fkey";
            columns: ["deck_id"];
            isOneToOne: false;
            referencedRelation: "flashcard_decks";
            referencedColumns: ["id"];
          },
        ];
      };
      group_members: {
        Row: {
          created_at: string;
          group_id: string;
          id: string;
          role: string;
          student_id: string;
        };
        Insert: {
          created_at?: string;
          group_id: string;
          id?: string;
          role?: string;
          student_id: string;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          id?: string;
          role?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_members_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      group_messages: {
        Row: {
          created_at: string;
          group_id: string;
          id: string;
          message: string;
          student_id: string;
        };
        Insert: {
          created_at?: string;
          group_id: string;
          id?: string;
          message: string;
          student_id: string;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          id?: string;
          message?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_messages_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      group_shared_resources: {
        Row: {
          created_at: string;
          group_id: string;
          id: string;
          resource_ref: string;
          resource_type: string;
          shared_by_student_id: string | null;
          title: string;
        };
        Insert: {
          created_at?: string;
          group_id: string;
          id?: string;
          resource_ref: string;
          resource_type: string;
          shared_by_student_id?: string | null;
          title?: string;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          id?: string;
          resource_ref?: string;
          resource_type?: string;
          shared_by_student_id?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_shared_resources_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_shared_resources_shared_by_student_id_fkey";
            columns: ["shared_by_student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      groups: {
        Row: {
          created_at: string;
          created_by_student_id: string | null;
          description: string;
          id: string;
          invite_code: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          created_by_student_id?: string | null;
          description?: string;
          id?: string;
          invite_code?: string;
          name?: string;
        };
        Update: {
          created_at?: string;
          created_by_student_id?: string | null;
          description?: string;
          id?: string;
          invite_code?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "groups_created_by_student_id_fkey";
            columns: ["created_by_student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      mastery_scores: {
        Row: {
          competency: string;
          created_at: string;
          id: string;
          level_label: string;
          numeric_score: number;
          student_id: string;
          subject_or_system: string;
          updated_at: string;
        };
        Insert: {
          competency: string;
          created_at?: string;
          id?: string;
          level_label: string;
          numeric_score: number;
          student_id: string;
          subject_or_system: string;
          updated_at?: string;
        };
        Update: {
          competency?: string;
          created_at?: string;
          id?: string;
          level_label?: string;
          numeric_score?: number;
          student_id?: string;
          subject_or_system?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mastery_scores_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          id: string;
          is_read: boolean;
          message: string;
          related_link: string | null;
          student_id: string;
          type: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message: string;
          related_link?: string | null;
          student_id: string;
          type: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message?: string;
          related_link?: string | null;
          student_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      notes: {
        Row: {
          content_id: string;
          content_type: string;
          created_at: string;
          id: string;
          is_shared: boolean;
          note_text: string;
          student_id: string;
        };
        Insert: {
          content_id: string;
          content_type: string;
          created_at?: string;
          id?: string;
          is_shared?: boolean;
          note_text: string;
          student_id: string;
        };
        Update: {
          content_id?: string;
          content_type?: string;
          created_at?: string;
          id?: string;
          is_shared?: boolean;
          note_text?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notes_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      leaderboard_opt_outs: {
        Row: { created_at: string; student_id: string };
        Insert: { created_at?: string; student_id: string };
        Update: { created_at?: string; student_id?: string };
        Relationships: [
          {
            foreignKeyName: "leaderboard_opt_outs_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: true;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      osce_attempts: {
        Row: {
          checklist_results: Json;
          completed_at: string;
          created_at: string;
          id: string;
          mode: string;
          score: number;
          station_id: string;
          student_id: string;
          time_taken_seconds: number;
        };
        Insert: {
          checklist_results?: Json;
          completed_at?: string;
          created_at?: string;
          id?: string;
          mode?: string;
          score?: number;
          station_id: string;
          student_id: string;
          time_taken_seconds?: number;
        };
        Update: {
          checklist_results?: Json;
          completed_at?: string;
          created_at?: string;
          id?: string;
          mode?: string;
          score?: number;
          station_id?: string;
          student_id?: string;
          time_taken_seconds?: number;
        };
        Relationships: [
          {
            foreignKeyName: "osce_attempts_station_id_fkey";
            columns: ["station_id"];
            isOneToOne: false;
            referencedRelation: "osce_stations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "osce_attempts_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      osce_circuit_attempts: {
        Row: {
          circuit_id: string;
          competency_breakdown: Json;
          completed_at: string;
          created_at: string;
          id: string;
          overall_result: string;
          per_station_results: Json;
          student_id: string;
        };
        Insert: {
          circuit_id: string;
          competency_breakdown?: Json;
          completed_at?: string;
          created_at?: string;
          id?: string;
          overall_result?: string;
          per_station_results?: Json;
          student_id: string;
        };
        Update: {
          circuit_id?: string;
          competency_breakdown?: Json;
          completed_at?: string;
          created_at?: string;
          id?: string;
          overall_result?: string;
          per_station_results?: Json;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "osce_circuit_attempts_circuit_id_fkey";
            columns: ["circuit_id"];
            isOneToOne: false;
            referencedRelation: "osce_circuits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "osce_circuit_attempts_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      osce_circuits: {
        Row: {
          created_at: string;
          created_by_student_id: string | null;
          id: string;
          name: string;
          station_ids: string[];
          type: string;
        };
        Insert: {
          created_at?: string;
          created_by_student_id?: string | null;
          id?: string;
          name: string;
          station_ids: string[];
          type: string;
        };
        Update: {
          created_at?: string;
          created_by_student_id?: string | null;
          id?: string;
          name?: string;
          station_ids?: string[];
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "osce_circuits_created_by_student_id_fkey";
            columns: ["created_by_student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      osce_stations: {
        Row: {
          candidate_instructions: string;
          category: string;
          created_at: string;
          difficulty: string;
          duration_minutes: number;
          examiner_checklist: Json;
          global_assessment_criteria: Json;
          hints: string[];
          id: string;
          is_published: boolean;
          learning_points: string[];
          patient_instructions: Json;
          resources: Json;
          specialty: string;
          suggested_structure: string[];
          title: string;
          topic: string;
          year: number;
        };
        Insert: {
          candidate_instructions?: string;
          category?: string;
          created_at?: string;
          difficulty?: string;
          duration_minutes?: number;
          examiner_checklist?: Json;
          global_assessment_criteria?: Json;
          hints?: string[];
          id?: string;
          is_published?: boolean;
          learning_points?: string[];
          patient_instructions?: Json;
          resources?: Json;
          specialty?: string;
          suggested_structure?: string[];
          title?: string;
          topic?: string;
          year?: number;
        };
        Update: {
          candidate_instructions?: string;
          category?: string;
          created_at?: string;
          difficulty?: string;
          duration_minutes?: number;
          examiner_checklist?: Json;
          global_assessment_criteria?: Json;
          hints?: string[];
          id?: string;
          is_published?: boolean;
          learning_points?: string[];
          patient_instructions?: Json;
          resources?: Json;
          specialty?: string;
          suggested_structure?: string[];
          title?: string;
          topic?: string;
          year?: number;
        };
        Relationships: [];
      };
      peer_osce_sessions: {
        Row: {
          candidate_student_id: string | null;
          created_at: string;
          examiner_student_id: string | null;
          id: string;
          patient_student_id: string | null;
          station_id: string;
          status: string;
        };
        Insert: {
          candidate_student_id?: string | null;
          created_at?: string;
          examiner_student_id?: string | null;
          id?: string;
          patient_student_id?: string | null;
          station_id: string;
          status?: string;
        };
        Update: {
          candidate_student_id?: string | null;
          created_at?: string;
          examiner_student_id?: string | null;
          id?: string;
          patient_student_id?: string | null;
          station_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "peer_osce_sessions_candidate_student_id_fkey";
            columns: ["candidate_student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "peer_osce_sessions_examiner_student_id_fkey";
            columns: ["examiner_student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "peer_osce_sessions_patient_student_id_fkey";
            columns: ["patient_student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "peer_osce_sessions_station_id_fkey";
            columns: ["station_id"];
            isOneToOne: false;
            referencedRelation: "osce_stations";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_questions: {
        Row: {
          clinical_competency: string;
          clinical_pearl: string;
          correct_answer: Json;
          created_at: string;
          difficulty: string;
          id: string;
          key_concept: string;
          media_url: string | null;
          option_explanations: Json;
          options: Json;
          organ_system: string;
          question_text: string;
          question_type: string;
          references: string[];
          related_case_id: string | null;
          related_flashcard_deck_id: string | null;
          subject: string;
          topic: string;
          year: number;
        };
        Insert: {
          clinical_competency?: string;
          clinical_pearl?: string;
          correct_answer?: Json;
          created_at?: string;
          difficulty?: string;
          id?: string;
          key_concept?: string;
          media_url?: string | null;
          option_explanations?: Json;
          options?: Json;
          organ_system?: string;
          question_text?: string;
          question_type?: string;
          references?: string[];
          related_case_id?: string | null;
          related_flashcard_deck_id?: string | null;
          subject?: string;
          topic?: string;
          year?: number;
        };
        Update: {
          clinical_competency?: string;
          clinical_pearl?: string;
          correct_answer?: Json;
          created_at?: string;
          difficulty?: string;
          id?: string;
          key_concept?: string;
          media_url?: string | null;
          option_explanations?: Json;
          options?: Json;
          organ_system?: string;
          question_text?: string;
          question_type?: string;
          references?: string[];
          related_case_id?: string | null;
          related_flashcard_deck_id?: string | null;
          subject?: string;
          topic?: string;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_questions_deck_fk";
            columns: ["related_flashcard_deck_id"];
            isOneToOne: false;
            referencedRelation: "flashcard_decks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_questions_related_case_id_fkey";
            columns: ["related_case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_sessions: {
        Row: {
          answers: Json;
          completed_at: string | null;
          created_at: string;
          group_id: string | null;
          id: string;
          mode: string;
          question_ids: string[];
          score: number | null;
          started_at: string;
          student_id: string;
        };
        Insert: {
          answers?: Json;
          completed_at?: string | null;
          created_at?: string;
          group_id?: string | null;
          id?: string;
          mode?: string;
          question_ids?: string[];
          score?: number | null;
          started_at?: string;
          student_id: string;
        };
        Update: {
          answers?: Json;
          completed_at?: string | null;
          created_at?: string;
          group_id?: string | null;
          id?: string;
          mode?: string;
          question_ids?: string[];
          score?: number | null;
          started_at?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_sessions_group_fk";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_sessions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_decks: {
        Row: {
          created_at: string;
          deck_id: string;
          id: string;
          student_id: string;
        };
        Insert: {
          created_at?: string;
          deck_id: string;
          id?: string;
          student_id: string;
        };
        Update: {
          created_at?: string;
          deck_id?: string;
          id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_decks_deck_id_fkey";
            columns: ["deck_id"];
            isOneToOne: false;
            referencedRelation: "flashcard_decks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_decks_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      student_achievements: {
        Row: {
          achievement_id: string;
          created_at: string;
          earned_at: string;
          id: string;
          student_id: string;
        };
        Insert: {
          achievement_id: string;
          created_at?: string;
          earned_at?: string;
          id?: string;
          student_id: string;
        };
        Update: {
          achievement_id?: string;
          created_at?: string;
          earned_at?: string;
          id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_achievements_achievement_id_fkey";
            columns: ["achievement_id"];
            isOneToOne: false;
            referencedRelation: "achievements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_achievements_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      students: {
        Row: {
          country: string;
          created_at: string;
          current_level: string | null;
          current_rotation: string | null;
          daily_study_target_minutes: number;
          email: string;
          id: string;
          level: number;
          longest_streak: number;
          medical_program: string;
          name: string;
          notification_prefs: Json;
          specialty_interests: string[];
          streak_days: number;
          study_goal: string | null;
          subjects_studying: string[];
          university: string;
          updated_at: string;
          weak_areas: string[];
          xp: number;
          year_of_study: number;
        };
        Insert: {
          country?: string;
          created_at?: string;
          current_level?: string | null;
          current_rotation?: string | null;
          daily_study_target_minutes?: number;
          email: string;
          id?: string;
          level?: number;
          longest_streak?: number;
          medical_program: string;
          name: string;
          notification_prefs?: Json;
          specialty_interests?: string[];
          streak_days?: number;
          study_goal?: string | null;
          subjects_studying?: string[];
          university: string;
          updated_at?: string;
          weak_areas?: string[];
          xp?: number;
          year_of_study: number;
        };
        Update: {
          country?: string;
          created_at?: string;
          current_level?: string | null;
          current_rotation?: string | null;
          daily_study_target_minutes?: number;
          email?: string;
          id?: string;
          level?: number;
          longest_streak?: number;
          medical_program?: string;
          name?: string;
          notification_prefs?: Json;
          specialty_interests?: string[];
          streak_days?: number;
          study_goal?: string | null;
          subjects_studying?: string[];
          university?: string;
          updated_at?: string;
          weak_areas?: string[];
          xp?: number;
          year_of_study?: number;
        };
        Relationships: [];
      };
      suggested_flashcards: {
        Row: {
          back: string;
          created_at: string;
          front: string;
          id: string;
          source_id: string;
          source_type: string;
          status: string;
          student_id: string;
          suggested_flashcard_id: string | null;
        };
        Insert: {
          back: string;
          created_at?: string;
          front: string;
          id?: string;
          source_id: string;
          source_type: string;
          status?: string;
          student_id: string;
          suggested_flashcard_id?: string | null;
        };
        Update: {
          back?: string;
          created_at?: string;
          front?: string;
          id?: string;
          source_id?: string;
          source_type?: string;
          status?: string;
          student_id?: string;
          suggested_flashcard_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "suggested_flashcards_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suggested_flashcards_suggested_flashcard_id_fkey";
            columns: ["suggested_flashcard_id"];
            isOneToOne: false;
            referencedRelation: "flashcards";
            referencedColumns: ["id"];
          },
        ];
      };
      weekly_challenges: {
        Row: {
          case_id: string;
          created_at: string;
          ends_at: string;
          id: string;
          rules: string[];
          starts_at: string;
        };
        Insert: {
          case_id: string;
          created_at?: string;
          ends_at: string;
          id?: string;
          rules?: string[];
          starts_at: string;
        };
        Update: {
          case_id?: string;
          created_at?: string;
          ends_at?: string;
          id?: string;
          rules?: string[];
          starts_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "weekly_challenges_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
      xp_events: {
        Row: {
          created_at: string;
          id: string;
          source_id: string;
          source_type: string;
          student_id: string;
          xp_amount: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          source_id: string;
          source_type: string;
          student_id: string;
          xp_amount: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          source_id?: string;
          source_type?: string;
          student_id?: string;
          xp_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "xp_events_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_items: {
        Row: {
          content_id: string;
          content_type: string;
          created_at: string;
          id: string;
          related_link: string;
          student_id: string;
          title: string;
        };
        Insert: {
          content_id: string;
          content_type: string;
          created_at?: string;
          id?: string;
          related_link: string;
          student_id: string;
          title: string;
        };
        Update: {
          content_id?: string;
          content_type?: string;
          created_at?: string;
          id?: string;
          related_link?: string;
          student_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_items_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
